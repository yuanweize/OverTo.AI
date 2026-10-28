import { NextRequest, NextResponse } from 'next/server';
import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { stripeTestConfig } from '@/billing/stripe-test';

/** Test-only checkout. A persisted reservation makes retries reuse one Stripe idempotency key. */
export async function POST(request: NextRequest) {
  const config = stripeTestConfig();
  if (!config || !auth || !pool || request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return NextResponse.json({ error: 'Testovací platby nejsou dostupné.' }, { status: 503 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.emailVerified) return NextResponse.json({ error: 'Přihlaste se.' }, { status: 401 });
  const requestId = request.headers.get('idempotency-key') ?? '';
  if (!/^[a-f0-9-]{36}$/i.test(requestId)) return NextResponse.json({ error: 'Chybí identifikátor požadavku.' }, { status: 400 });
  const { workspaceId } = await personalWorkspace(session.user.id);
  try {
    const price = await config.stripe.prices.retrieve(config.priceId);
    if (price.livemode || !price.active || price.type !== 'recurring' || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) return NextResponse.json({ error: 'Testovací tarif není správně nakonfigurován.' }, { status: 503 });
    const client = await pool.connect();
    let attempt: { request_id: string; expires_at: Date; stripe_session_id: string | null };
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspaceId]);
      const existing = await client.query<{ request_id: string; expires_at: Date; stripe_session_id: string | null }>('SELECT request_id,expires_at,stripe_session_id FROM local_stripe_checkout_attempts WHERE workspace_id=$1 AND expires_at > now()', [workspaceId]);
      if (existing.rowCount && existing.rows[0].request_id !== requestId) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Již existuje rozpracovaná testovací platba. Počkejte na její vypršení.' }, { status: 409 });
      }
      if (existing.rowCount) attempt = existing.rows[0];
      else {
        const saved = await client.query<{ request_id: string; expires_at: Date; stripe_session_id: string | null }>(`INSERT INTO local_stripe_checkout_attempts (workspace_id,request_id,expires_at,stripe_session_id)
          VALUES ($1,$2,now()+interval '1 hour',NULL) ON CONFLICT (workspace_id) DO UPDATE SET request_id=excluded.request_id,expires_at=excluded.expires_at,stripe_session_id=NULL RETURNING request_id,expires_at,stripe_session_id`, [workspaceId, requestId]);
        attempt = saved.rows[0];
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    let customer = await pool.query<{ stripe_customer_id: string }>('SELECT stripe_customer_id FROM local_stripe_customers WHERE workspace_id=$1', [workspaceId]);
    if (!customer.rowCount) {
      const created = await config.stripe.customers.create({ metadata: { workspaceId } }, { idempotencyKey: `overto-test-customer-${session.user.id}` });
      if (created.livemode) throw new Error('LIVE_CUSTOMER');
      await pool.query('INSERT INTO local_stripe_customers (workspace_id,stripe_customer_id) VALUES ($1,$2) ON CONFLICT (workspace_id) DO NOTHING', [workspaceId, created.id]);
      customer = await pool.query('SELECT stripe_customer_id FROM local_stripe_customers WHERE workspace_id=$1', [workspaceId]);
    }
    const customerId = customer.rows[0].stripe_customer_id;
    const subscriptions = await config.stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    if (subscriptions.has_more || subscriptions.data.some(item => ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(item.status))) return NextResponse.json({ error: 'Tento testovací účet již má předplatné. Otevřete fakturační portál.' }, { status: 409 });
    const checkout = await config.stripe.checkout.sessions.create({ mode: 'subscription', customer: customerId, client_reference_id: workspaceId, line_items: [{ price: config.priceId, quantity: 1 }], subscription_data: { metadata: { workspaceId } }, expires_at: Math.floor(attempt.expires_at.getTime() / 1000), success_url: 'http://127.0.0.1:3005/dashboard/billing?checkout=test-success', cancel_url: 'http://127.0.0.1:3005/dashboard/billing?checkout=test-canceled' }, { idempotencyKey: `overto-test-checkout-${session.user.id}-${requestId}` });
    if (checkout.livemode || !checkout.url || new URL(checkout.url).hostname !== 'checkout.stripe.com') throw new Error('INVALID_CHECKOUT');
    await pool.query('UPDATE local_stripe_checkout_attempts SET stripe_session_id=$1 WHERE workspace_id=$2 AND request_id=$3', [checkout.id, workspaceId, requestId]);
    return NextResponse.json({ url: checkout.url, mode: 'test' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Testovací platební stránku se nepodařilo vytvořit. Opakujte stejný požadavek.' }, { status: 502 }); }
}
