import type { Pool } from 'pg';
import type Stripe from 'stripe';
import type { PlanVersion } from './catalog';

type Mode = 'test' | 'live';
type Order = {
  id: string; workspace_id: string; plan_version_id: string; status: string;
  stripe_checkout_session_id: string | null; expires_at: Date;
};

const stripeId = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id;
const activeSubscription = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);

/** Creates a durable order before redirecting; no redirect can grant credits. */
export class BillingCheckout {
  constructor(
    private readonly pool: Pool,
    private readonly stripe: Stripe,
    private readonly mode: Mode,
    private readonly publicOrigin: string,
    private readonly automaticTax: boolean,
  ) {}

  async create(workspaceId: string, planVersionId: string, requestId: string): Promise<{ url: string; orderId: string }> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planVersionId)) throw new Error('INVALID_REQUEST');
    const client = await this.pool.connect();
    let order: Order;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`billing:${this.mode}:${workspaceId}`]);
      const prior = await client.query<Order>('SELECT id,workspace_id,plan_version_id,status,stripe_checkout_session_id,expires_at FROM billing_orders WHERE mode=$1 AND workspace_id=$2 AND request_id=$3', [this.mode, workspaceId, requestId]);
      if (prior.rowCount) {
        order = prior.rows[0];
        if (order.plan_version_id !== planVersionId) throw new Error('IDEMPOTENCY_CONFLICT');
        if (order.status !== 'PENDING' || order.expires_at <= new Date()) throw new Error('CHECKOUT_EXPIRED');
      } else {
        const selected = await client.query<PlanVersion>(`SELECT p.* FROM billing_plan_versions p
          WHERE p.id=$1 AND p.is_visible AND p.is_purchasable AND p.effective_at<=now()
            AND (p.retired_at IS NULL OR p.retired_at>now())
            AND p.id=(SELECT id FROM billing_plan_versions WHERE code=p.code AND effective_at<=now()
              ORDER BY effective_at DESC,version DESC LIMIT 1)`, [planVersionId]);
        const plan = selected.rows[0];
        if (!plan || !plan.is_purchasable || plan.kind === 'FREE') throw new Error('PLAN_UNAVAILABLE');
        if (plan.kind === 'MONTHLY') {
          const subscription = await client.query<{ status: string }>('SELECT status FROM billing_subscriptions WHERE mode=$1 AND workspace_id=$2', [this.mode, workspaceId]);
          if (subscription.rows.some(item => activeSubscription.has(item.status))) throw new Error('SUBSCRIPTION_EXISTS');
          const pending = await client.query('SELECT 1 FROM billing_orders WHERE mode=$1 AND workspace_id=$2 AND kind=$3 AND status=$4 AND expires_at>now() LIMIT 1', [this.mode, workspaceId, 'MONTHLY', 'PENDING']);
          if (pending.rowCount) throw new Error('CHECKOUT_IN_PROGRESS');
        }
        const saved = await client.query<Order>(`INSERT INTO billing_orders(mode,workspace_id,plan_version_id,request_id,kind,amount_minor,currency,credits,expires_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '1 hour')
          RETURNING id,workspace_id,plan_version_id,status,stripe_checkout_session_id,expires_at`,
        [this.mode, workspaceId, plan.id, requestId, plan.kind, plan.amount_minor, plan.currency,
          plan.kind === 'MONTHLY' ? plan.monthly_credits : plan.pack_credits]);
        order = saved.rows[0];
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }

    if (order.stripe_checkout_session_id) {
      const session = await this.stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
      if (session.livemode !== (this.mode === 'live') || session.status !== 'open' || !this.validCheckoutUrl(session.url)) throw new Error('CHECKOUT_EXPIRED');
      return { url: session.url!, orderId: order.id };
    }

    const plan = await this.planForOrder(order.plan_version_id);
    const priceId = this.mode === 'test' ? plan.stripe_test_price_id : plan.stripe_live_price_id;
    const productId = this.mode === 'test' ? plan.stripe_test_product_id : plan.stripe_live_product_id;
    if (!priceId || !productId) throw new Error('PRICE_UNAVAILABLE');
    const price = await this.stripe.prices.retrieve(priceId);
    if (price.livemode !== (this.mode === 'live') || !price.active || price.currency.toUpperCase() !== plan.currency ||
        price.unit_amount !== Number(plan.amount_minor) || stripeId(price.product) !== productId ||
        (plan.kind === 'MONTHLY'
          ? price.type !== 'recurring' || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1
          : price.type !== 'one_time')) throw new Error('PRICE_MISMATCH');

    const customerId = await this.customer(workspaceId);
    if (plan.kind === 'MONTHLY') {
      const subscriptions = await this.stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
      if (subscriptions.has_more || subscriptions.data.some(item => activeSubscription.has(item.status))) throw new Error('SUBSCRIPTION_EXISTS');
    }
    const metadata = { orderId: order.id, workspaceId, planVersionId: plan.id, billingMode: this.mode };
    const session = await this.stripe.checkout.sessions.create({
      mode: plan.kind === 'MONTHLY' ? 'subscription' : 'payment',
      allowed_payment_method_types: ['card'],
      customer: customerId,
      client_reference_id: order.id,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      ...(plan.kind === 'MONTHLY' ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
      ...(this.automaticTax ? { automatic_tax: { enabled: true } } : {}),
      expires_at: Math.floor(order.expires_at.getTime() / 1000),
      success_url: `${this.publicOrigin}/dashboard/billing?checkout=returned`,
      cancel_url: `${this.publicOrigin}/dashboard/billing?checkout=canceled`,
    }, { idempotencyKey: `overto-${this.mode}-checkout-${order.id}` });
    if (session.livemode !== (this.mode === 'live') || !this.validCheckoutUrl(session.url)) throw new Error('INVALID_CHECKOUT');
    const linked = await this.pool.query(`UPDATE billing_orders SET stripe_customer_id=$1,stripe_checkout_session_id=$2,updated_at=now()
      WHERE id=$3 AND mode=$4 AND status='PENDING' AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id=$2)`,
    [customerId, session.id, order.id, this.mode]);
    if (linked.rowCount !== 1) throw new Error('ORDER_CHANGED');
    return { url: session.url!, orderId: order.id };
  }

  private async planForOrder(id: string): Promise<PlanVersion> {
    const result = await this.pool.query<PlanVersion>('SELECT * FROM billing_plan_versions WHERE id=$1', [id]);
    if (!result.rowCount) throw new Error('PLAN_UNAVAILABLE');
    return result.rows[0];
  }

  private async customer(workspaceId: string): Promise<string> {
    const existing = await this.pool.query<{ stripe_customer_id: string }>('SELECT stripe_customer_id FROM billing_customers WHERE mode=$1 AND workspace_id=$2', [this.mode, workspaceId]);
    if (existing.rowCount) {
      const customer = await this.stripe.customers.retrieve(existing.rows[0].stripe_customer_id);
      if (customer.deleted || customer.livemode !== (this.mode === 'live') || customer.metadata.workspaceId !== workspaceId) throw new Error('CUSTOMER_MISMATCH');
      return customer.id;
    }
    const created = await this.stripe.customers.create({ metadata: { workspaceId, billingMode: this.mode } }, { idempotencyKey: `overto-${this.mode}-customer-${workspaceId}` });
    if (created.livemode !== (this.mode === 'live')) throw new Error('CUSTOMER_MISMATCH');
    await this.pool.query('INSERT INTO billing_customers(mode,workspace_id,stripe_customer_id) VALUES($1,$2,$3) ON CONFLICT(mode,workspace_id) DO NOTHING', [this.mode, workspaceId, created.id]);
    const stored = await this.pool.query<{ stripe_customer_id: string }>('SELECT stripe_customer_id FROM billing_customers WHERE mode=$1 AND workspace_id=$2', [this.mode, workspaceId]);
    if (stored.rows[0]?.stripe_customer_id !== created.id) throw new Error('CUSTOMER_MISMATCH');
    return created.id;
  }

  private validCheckoutUrl(value: string | null): value is string {
    if (!value) return false;
    try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'checkout.stripe.com'; }
    catch { return false; }
  }
}
