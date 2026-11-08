import type { Pool, PoolClient } from 'pg';
import type Stripe from 'stripe';
import { CreditLedger } from './credit-ledger';

type Mode = 'test' | 'live';
type Order = {
  id: string; workspace_id: string; kind: 'MONTHLY' | 'CREDIT_PACK';
  amount_minor: string; currency: string; credits: number; status: string;
  plan_version_id: string; stripe_customer_id: string | null; stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null; stripe_subscription_id: string | null; created_at: Date;
};
const id = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id;
const integer = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** Stripe objects are fetched before the transaction; one event and its ledger changes commit atomically. */
export class BillingEvents {
  constructor(private readonly pool: Pool, private readonly stripe: Stripe, private readonly mode: Mode) {}

  async process(event: Stripe.Event): Promise<void> {
    if (event.livemode !== (this.mode === 'live')) throw new Error('EVENT_MODE_MISMATCH');
    const types = new Set(['checkout.session.completed', 'invoice.paid', 'invoice.payment_failed',
      'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
      'charge.refunded', 'charge.dispute.created']);
    if (!types.has(event.type)) return;

    let checkout: Stripe.Checkout.Session | undefined;
    let intent: Stripe.PaymentIntent | undefined;
    let invoice: Stripe.Invoice | undefined;
    let subscription: Stripe.Subscription | undefined;
    let charge: Stripe.Charge | undefined;
    let alreadyRefundedCharge: Stripe.Charge | undefined;
    let invoiceIntentId: string | undefined;
    if (event.type === 'checkout.session.completed') {
      checkout = await this.stripe.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id);
      if (checkout.mode === 'payment' && checkout.payment_intent) intent = await this.stripe.paymentIntents.retrieve(id(checkout.payment_intent)!);
      if (intent?.latest_charge) alreadyRefundedCharge = await this.stripe.charges.retrieve(id(intent.latest_charge)!);
    } else if (event.type.startsWith('invoice.')) {
      invoice = await this.stripe.invoices.retrieve((event.data.object as Stripe.Invoice).id);
      const subId = id(invoice.parent?.subscription_details?.subscription);
      if (!subId) throw new Error('INVOICE_SUBSCRIPTION_MISSING');
      subscription = await this.stripe.subscriptions.retrieve(subId);
      if (invoice.status === 'paid') {
        const payments = await this.stripe.invoicePayments.list({ invoice: invoice.id, limit: 100 });
        if (payments.has_more) throw new Error('INVOICE_PAYMENTS_INCOMPLETE');
        const intents = payments.data.filter(payment => payment.status === 'paid' && payment.payment.type === 'payment_intent');
        if (intents.length === 1) invoiceIntentId = id(intents[0].payment.payment_intent);
        if (!invoiceIntentId) throw new Error('INVOICE_PAYMENT_UNCONFIRMED');
        intent = await this.stripe.paymentIntents.retrieve(invoiceIntentId);
        if (intent.status !== 'succeeded' || id(intent.customer) !== id(invoice.customer) ||
          intent.currency.toUpperCase() !== invoice.currency.toUpperCase() || intent.amount_received < invoice.amount_paid) throw new Error('INVOICE_PAYMENT_UNCONFIRMED');
        if (intent.latest_charge) alreadyRefundedCharge = await this.stripe.charges.retrieve(id(intent.latest_charge)!);
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      subscription = await this.stripe.subscriptions.retrieve((event.data.object as Stripe.Subscription).id);
    } else {
      const chargeId = event.type === 'charge.refunded' ? (event.data.object as Stripe.Charge).id : id((event.data.object as Stripe.Dispute).charge);
      if (!chargeId) throw new Error('CHARGE_MISSING');
      charge = await this.stripe.charges.retrieve(chargeId);
    }
    if ([checkout, intent, invoice, subscription, charge, alreadyRefundedCharge].some(object => object && object.livemode !== (this.mode === 'live'))) throw new Error('OBJECT_MODE_MISMATCH');

    const orderId = checkout?.metadata?.orderId ?? subscription?.metadata?.orderId;
    let order: Order | undefined;
    if (orderId) order = (await this.pool.query<Order>('SELECT * FROM billing_orders WHERE id=$1 AND mode=$2', [orderId, this.mode])).rows[0];
    else if (charge?.payment_intent) {
      const paymentIntentId = id(charge.payment_intent);
      order = (await this.pool.query<Order>('SELECT * FROM billing_orders WHERE mode=$1 AND stripe_payment_intent_id=$2', [this.mode, paymentIntentId])).rows[0];
      if (!order) {
        const paidInvoice = await this.pool.query<{ stripe_subscription_id: string }>('SELECT stripe_subscription_id FROM billing_invoices WHERE mode=$1 AND stripe_payment_intent_id=$2', [this.mode, paymentIntentId]);
        if (paidInvoice.rowCount) {
          order = (await this.pool.query<Order>('SELECT * FROM billing_orders WHERE mode=$1 AND stripe_subscription_id=$2 AND kind=$3 ORDER BY created_at LIMIT 1', [this.mode, paidInvoice.rows[0].stripe_subscription_id, 'MONTHLY'])).rows[0];
        }
      }
    }
    if (!order) throw new Error('ORDER_NOT_FOUND');
    const customerId = id(checkout?.customer ?? invoice?.customer ?? subscription?.customer ?? charge?.customer);
    if (!customerId || (order.stripe_customer_id && order.stripe_customer_id !== customerId)) throw new Error('CUSTOMER_MISMATCH');
    const mapped = await this.pool.query<{ workspace_id: string }>('SELECT workspace_id FROM billing_customers WHERE mode=$1 AND stripe_customer_id=$2', [this.mode, customerId]);
    if (mapped.rows[0]?.workspace_id !== order.workspace_id) throw new Error('WORKSPACE_MISMATCH');
    if (checkout) this.validateCheckout(checkout, order, intent);
    if (invoice && subscription) {
      const plan = await this.pool.query<{ stripe_test_price_id: string | null; stripe_live_price_id: string | null }>('SELECT stripe_test_price_id,stripe_live_price_id FROM billing_plan_versions WHERE id=$1', [order.plan_version_id]);
      const expectedPrice = this.mode === 'test' ? plan.rows[0]?.stripe_test_price_id : plan.rows[0]?.stripe_live_price_id;
      this.validateInvoice(invoice, subscription, order, invoice.status === 'paid', expectedPrice);
    }
    if (subscription && id(subscription.customer) !== customerId) throw new Error('SUBSCRIPTION_CUSTOMER_MISMATCH');
    if (charge && (!integer(charge.amount) || charge.amount <= 0 || !integer(charge.amount_refunded) || charge.amount_refunded > charge.amount)) throw new Error('INVALID_REFUND');
    if (alreadyRefundedCharge && (id(alreadyRefundedCharge.customer) !== customerId || id(alreadyRefundedCharge.payment_intent) !== intent?.id ||
      !integer(alreadyRefundedCharge.amount) || !integer(alreadyRefundedCharge.amount_refunded) || alreadyRefundedCharge.amount_refunded > alreadyRefundedCharge.amount)) throw new Error('INVALID_REFUND');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`billing:${this.mode}:${order.workspace_id}`]);
      const seen = await client.query('SELECT 1 FROM billing_webhook_events WHERE mode=$1 AND stripe_event_id=$2', [this.mode, event.id]);
      if (!seen.rowCount) {
        const linked = await client.query('UPDATE billing_orders SET stripe_customer_id=$1 WHERE id=$2 AND mode=$3 AND (stripe_customer_id IS NULL OR stripe_customer_id=$1)', [customerId, order.id, this.mode]);
        if (linked.rowCount !== 1) throw new Error('CUSTOMER_MISMATCH');
        order.stripe_customer_id = customerId;
        if (checkout) await this.applyCheckout(client, checkout, intent, order);
        if (invoice && subscription) await this.applyInvoice(client, invoice, subscription, order, invoice.status === 'paid', invoiceIntentId);
        else if (subscription) await this.applySubscription(client, subscription, order);
        if (charge) await this.applyCharge(client, charge, order, event.type === 'charge.dispute.created');
        if (alreadyRefundedCharge?.amount_refunded) await this.applyCharge(client, alreadyRefundedCharge, order, false);
        await client.query('INSERT INTO billing_webhook_events(mode,stripe_event_id,event_type) VALUES($1,$2,$3)', [this.mode, event.id, event.type]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }

  private validateCheckout(checkout: Stripe.Checkout.Session, order: Order, intent?: Stripe.PaymentIntent) {
    if ((order.stripe_checkout_session_id && checkout.id !== order.stripe_checkout_session_id) || checkout.client_reference_id !== order.id || checkout.metadata?.workspaceId !== order.workspace_id ||
      checkout.metadata?.planVersionId !== order.plan_version_id || checkout.metadata?.billingMode !== this.mode ||
      checkout.currency?.toUpperCase() !== order.currency || checkout.amount_subtotal !== Number(order.amount_minor)) throw new Error('CHECKOUT_MISMATCH');
    if (order.kind === 'CREDIT_PACK') {
      if (checkout.mode !== 'payment' || checkout.payment_status !== 'paid' || !intent || intent.status !== 'succeeded' ||
        intent.amount_received < Number(order.amount_minor) || intent.currency.toUpperCase() !== order.currency || id(intent.customer) !== id(checkout.customer)) throw new Error('PAYMENT_NOT_CONFIRMED');
    } else if (checkout.mode !== 'subscription' || !checkout.subscription) throw new Error('SUBSCRIPTION_MISSING');
  }

  private validateInvoice(invoice: Stripe.Invoice, subscription: Stripe.Subscription, order: Order, paid: boolean, expectedPrice?: string | null) {
    const subId = id(invoice.parent?.subscription_details?.subscription);
    if (order.kind !== 'MONTHLY' || subId !== subscription.id || subscription.metadata.orderId !== order.id ||
      invoice.currency.toUpperCase() !== order.currency || invoice.lines.has_more) throw new Error('INVOICE_MISMATCH');
    if (paid) {
      const matching = invoice.lines.data.filter(line => id(line.pricing?.price_details?.price) === expectedPrice && line.quantity === 1 && line.parent?.subscription_item_details?.proration === false);
      if (!expectedPrice || subscription.items.data.length !== 1 || subscription.items.data[0].price.id !== expectedPrice ||
        invoice.status !== 'paid' || !['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason ?? '') ||
        matching.length !== 1 || !integer(invoice.amount_paid) || invoice.amount_paid < Number(order.amount_minor)) throw new Error('INVOICE_NOT_ELIGIBLE');
    }
  }

  private async applyCheckout(client: PoolClient, session: Stripe.Checkout.Session, intent: Stripe.PaymentIntent | undefined, order: Order) {
    if (order.kind === 'CREDIT_PACK') {
      const updated = await client.query(`UPDATE billing_orders SET status='PAID',stripe_checkout_session_id=$1,stripe_payment_intent_id=$2,stripe_subscription_id=NULL,tax_amount_minor=$3,paid_at=COALESCE(paid_at,now()),updated_at=now()
        WHERE id=$4 AND mode=$5 AND status IN ('PENDING','PAID') AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id=$1) AND (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id=$2)`,
      [session.id, intent!.id, session.total_details?.amount_tax ?? null, order.id, this.mode]);
      if (updated.rowCount !== 1) throw new Error('ORDER_STATE_MISMATCH');
      const account = await client.query('SELECT 1 FROM credit_accounts WHERE id=$1', [order.workspace_id]);
      if (account.rowCount) await new CreditLedger(this.pool).grantInTransaction(client, order.workspace_id, `stripe-${this.mode}-checkout:${session.id}`, order.credits, 'PURCHASED');
    } else {
      const subscriptionId = id(session.subscription)!;
      const updated = await client.query(`UPDATE billing_orders SET status=CASE WHEN status='PAID' THEN status ELSE 'PROCESSING' END,stripe_checkout_session_id=$1,stripe_subscription_id=$2,updated_at=now()
        WHERE id=$3 AND mode=$4 AND status IN ('PENDING','PROCESSING','PAID') AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id=$1) AND (stripe_subscription_id IS NULL OR stripe_subscription_id=$2)`,
      [session.id, subscriptionId, order.id, this.mode]);
      if (updated.rowCount !== 1) throw new Error('ORDER_STATE_MISMATCH');
    }
  }

  private async applySubscription(client: PoolClient, subscription: Stripe.Subscription, order: Order) {
    const updated = await client.query(`UPDATE billing_orders SET stripe_subscription_id=$1,updated_at=now()
      WHERE id=$2 AND mode=$3 AND kind='MONTHLY' AND (stripe_subscription_id IS NULL OR stripe_subscription_id=$1)`, [subscription.id, order.id, this.mode]);
    if (updated.rowCount !== 1) throw new Error('SUBSCRIPTION_ORDER_MISMATCH');
    const current = await client.query<{ stripe_subscription_id: string; status: string; order_created_at: Date | null }>(`SELECT s.stripe_subscription_id,s.status,o.created_at AS order_created_at
      FROM billing_subscriptions s LEFT JOIN LATERAL (
        SELECT created_at FROM billing_orders WHERE mode=s.mode AND stripe_subscription_id=s.stripe_subscription_id
        ORDER BY created_at DESC LIMIT 1
      ) o ON true WHERE s.mode=$1 AND s.workspace_id=$2 FOR UPDATE OF s`, [this.mode, order.workspace_id]);
    const existing = current.rows[0];
    if (existing && existing.stripe_subscription_id !== subscription.id) {
      if (!existing.order_created_at || !order.created_at) throw new Error('SUBSCRIPTION_ORDER_UNKNOWN');
      // A delayed event from the previous subscription may still create its
      // own invoice/credit, but must never replace a newer subscription.
      if (order.created_at <= existing.order_created_at) return;
      if (!['canceled', 'incomplete_expired'].includes(existing.status)) throw new Error('SUBSCRIPTION_CONFLICT');
    }
    if (existing) {
      await client.query(`UPDATE billing_subscriptions SET stripe_customer_id=$1,stripe_subscription_id=$2,
        plan_version_id=$3,status=$4,cancel_at_period_end=$5,updated_at=now() WHERE mode=$6 AND workspace_id=$7`,
      [order.stripe_customer_id, subscription.id, order.plan_version_id, subscription.status, subscription.cancel_at_period_end, this.mode, order.workspace_id]);
    } else {
      await client.query(`INSERT INTO billing_subscriptions(mode,workspace_id,stripe_customer_id,stripe_subscription_id,plan_version_id,status,cancel_at_period_end)
        VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [this.mode, order.workspace_id, order.stripe_customer_id, subscription.id, order.plan_version_id, subscription.status, subscription.cancel_at_period_end]);
    }
  }

  private async applyInvoice(client: PoolClient, invoice: Stripe.Invoice, subscription: Stripe.Subscription, order: Order, paid: boolean, intentId?: string) {
    await this.applySubscription(client, subscription, order);
    if (!paid) await client.query("UPDATE billing_subscriptions SET status='past_due',updated_at=now() WHERE mode=$1 AND workspace_id=$2 AND stripe_subscription_id=$3 AND status NOT IN ('canceled','unpaid')", [this.mode, order.workspace_id, subscription.id]);
    const status = paid ? 'paid' : 'payment_failed';
    await client.query(`INSERT INTO billing_invoices(mode,stripe_invoice_id,workspace_id,stripe_subscription_id,stripe_payment_intent_id,plan_version_id,status,currency,amount_due_minor,amount_paid_minor,tax_amount_minor,hosted_invoice_url,invoice_pdf_url,paid_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT(mode,stripe_invoice_id) DO UPDATE SET status=CASE WHEN billing_invoices.status IN ('refunded','partial_refund','disputed') THEN billing_invoices.status ELSE excluded.status END,
      stripe_payment_intent_id=COALESCE(excluded.stripe_payment_intent_id,billing_invoices.stripe_payment_intent_id),
      amount_paid_minor=excluded.amount_paid_minor,paid_at=excluded.paid_at,updated_at=now()`,
    [this.mode, invoice.id, order.workspace_id, subscription.id, intentId ?? null, order.plan_version_id, status,
      invoice.currency.toUpperCase(), invoice.amount_due, invoice.amount_paid, invoice.total_taxes?.reduce((sum, tax) => sum + tax.amount, 0) ?? null,
      invoice.hosted_invoice_url, invoice.invoice_pdf, paid ? new Date() : null]);
    if (paid) {
      if (invoice.billing_reason === 'subscription_create' && intentId) {
        const linked = await client.query('UPDATE billing_orders SET stripe_payment_intent_id=$1 WHERE id=$2 AND mode=$3 AND (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id=$1)', [intentId, order.id, this.mode]);
        if (linked.rowCount !== 1) throw new Error('INITIAL_INVOICE_MISMATCH');
        order.stripe_payment_intent_id = intentId;
      }
      // A deleted personal workspace has no credit account. Keep the immutable
      // payment record for reconciliation without resurrecting deleted data.
      const account = await client.query('SELECT 1 FROM credit_accounts WHERE id=$1', [order.workspace_id]);
      if (account.rowCount) await new CreditLedger(this.pool).grantInTransaction(client, order.workspace_id, `stripe-${this.mode}-invoice:${invoice.id}`, order.credits, 'SUBSCRIPTION');
      await client.query("UPDATE billing_orders SET status='PAID',paid_at=COALESCE(paid_at,now()),updated_at=now() WHERE id=$1 AND mode=$2 AND status IN ('PENDING','PROCESSING','PAID')", [order.id, this.mode]);
    }
  }

  private async applyCharge(client: PoolClient, charge: Stripe.Charge, order: Order, dispute: boolean) {
    const paymentIntentId = id(charge.payment_intent);
    const invoice = paymentIntentId ? await client.query<{ stripe_invoice_id: string }>('SELECT stripe_invoice_id FROM billing_invoices WHERE mode=$1 AND stripe_payment_intent_id=$2', [this.mode, paymentIntentId]) : null;
    const grantKey = invoice?.rows[0] ? `stripe-${this.mode}-invoice:${invoice.rows[0].stripe_invoice_id}` : `stripe-${this.mode}-checkout:${order.stripe_checkout_session_id}`;
    const grant = await client.query<{ id: string; amount: number }>('SELECT id,amount FROM credit_grants WHERE account_id=$1 AND idempotency_key=$2', [order.workspace_id, grantKey]);
    const accountExists = await client.query('SELECT 1 FROM credit_accounts WHERE id=$1', [order.workspace_id]);
    if (!grant.rowCount && accountExists.rowCount) throw new Error('REFUND_GRANT_PENDING');
    const refunded = dispute ? charge.amount : charge.amount_refunded;
    const tracked = await client.query<{ cumulative_refunded_minor: string }>(`INSERT INTO billing_refund_tracking(mode,stripe_charge_id,workspace_id,stripe_payment_intent_id,stripe_invoice_id,total_amount_minor,cumulative_refunded_minor)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(mode,stripe_charge_id) DO UPDATE SET
      cumulative_refunded_minor=GREATEST(billing_refund_tracking.cumulative_refunded_minor,excluded.cumulative_refunded_minor),updated_at=now()
      WHERE billing_refund_tracking.workspace_id=excluded.workspace_id AND billing_refund_tracking.total_amount_minor=excluded.total_amount_minor
      RETURNING cumulative_refunded_minor`, [this.mode, charge.id, order.workspace_id, paymentIntentId, invoice?.rows[0]?.stripe_invoice_id ?? null, charge.amount, refunded]);
    if (!tracked.rowCount) throw new Error('REFUND_MISMATCH');
    const target = grant.rowCount ? Math.min(grant.rows[0].amount, Math.round(grant.rows[0].amount * Number(tracked.rows[0].cumulative_refunded_minor) / charge.amount)) : 0;
    if (grant.rowCount) {
      const applied = await client.query<{ amount: number }>('SELECT COALESCE(SUM(amount),0)::int AS amount FROM credit_reversals WHERE grant_id=$1', [grant.rows[0].id]);
      const delta = target - applied.rows[0].amount;
      if (delta > 0) await new CreditLedger(this.pool).reverseInTransaction(client, order.workspace_id,
        `stripe-${this.mode}-refund:${charge.id}:${target}`, grantKey, delta, dispute ? 'STRIPE_DISPUTE' : 'STRIPE_REFUND');
    }
    await client.query('UPDATE billing_refund_tracking SET credits_reversed=$1 WHERE mode=$2 AND stripe_charge_id=$3', [target, this.mode, charge.id]);
    const cumulativeRefunded = Number(tracked.rows[0].cumulative_refunded_minor);
    const refundStatus = dispute ? 'DISPUTED' : cumulativeRefunded === charge.amount ? 'REFUNDED' : 'PARTIAL_REFUND';
    if (invoice?.rows[0]) {
      await client.query(`UPDATE billing_invoices SET status=CASE WHEN status='disputed' THEN status ELSE $1 END,updated_at=now()
        WHERE mode=$2 AND stripe_invoice_id=$3`, [refundStatus.toLowerCase(), this.mode, invoice.rows[0].stripe_invoice_id]);
    }
    if (!invoice?.rows[0] || order.stripe_payment_intent_id === paymentIntentId) {
      await client.query(`UPDATE billing_orders SET amount_refunded_minor=GREATEST(amount_refunded_minor,$1),
        status=CASE WHEN status='DISPUTED' THEN status ELSE $2 END,updated_at=now() WHERE id=$3 AND mode=$4`,
      [cumulativeRefunded, refundStatus, order.id, this.mode]);
    }
  }
}
