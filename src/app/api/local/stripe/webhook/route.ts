import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { pool } from '@/auth/server';
import { stripeTestConfig } from '@/billing/stripe-test';
import { CreditLedger } from '@/billing/credit-ledger';
import { verifyTestEvent } from '@/billing/stripe-signature';
import { readRequestBody } from '@/lib/read-request-body';

const id = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id;

/** Test-only endpoint. Raw messages and signature headers are never logged or stored. */
export async function POST(request: NextRequest) {
  const config = stripeTestConfig();
  if (!config || !pool) return NextResponse.json({ error: 'Stripe test mode unavailable' }, { status: 503 });
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  let body: Uint8Array;
  try { body = await readRequestBody(request, 262144); }
  catch (error) {
    const code = error instanceof Error ? error.message : '';
    return NextResponse.json({ error: code === 'BODY_TOO_LARGE' ? 'Body too large' : code === 'BODY_TIMEOUT' ? 'Body timeout' : 'Missing body' }, { status: code === 'BODY_TOO_LARGE' ? 413 : code === 'BODY_TIMEOUT' ? 408 : 400 });
  }
  const event = verifyTestEvent(config.stripe, Buffer.from(body), signature, config.webhookSecret);
  if (!event) return NextResponse.json({ error: 'Invalid signature or live event' }, { status: 400 });
  if (event.type !== 'invoice.paid' && !event.type.startsWith('customer.subscription.')) return NextResponse.json({ received: true });
  try {
    let customerId: string | undefined; let invoice: Stripe.Invoice | undefined; let subscriptionId: string | undefined;
    if (event.type === 'invoice.paid') {
      const invoiceId = (event.data.object as Stripe.Invoice).id;
      invoice = await config.stripe.invoices.retrieve(invoiceId);
      customerId = id(invoice.customer);
      subscriptionId = id(invoice.parent?.subscription_details?.subscription);
      if (invoice.livemode || invoice.status !== 'paid' || !customerId || !subscriptionId) throw new Error('INVALID_INVOICE');
    } else {
      const snapshot = event.data.object as Stripe.Subscription;
      customerId = id(snapshot.customer); subscriptionId = snapshot.id;
      if (!customerId || !subscriptionId) throw new Error('INVALID_SUBSCRIPTION');
    }
    const mapping = await pool.query<{ workspace_id: string }>('SELECT workspace_id FROM local_stripe_customers WHERE stripe_customer_id=$1', [customerId]);
    if (!mapping.rowCount) throw new Error('UNMAPPED_CUSTOMER');
    const workspaceId = mapping.rows[0].workspace_id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspaceId]);
      const seen = await client.query('SELECT event_id FROM local_stripe_events WHERE event_id=$1', [event.id]);
      if (!seen.rowCount) {
        // Fetch current subscription after taking the lock so old event snapshots cannot overwrite newer state.
        const subscription = await config.stripe.subscriptions.retrieve(subscriptionId);
        if (subscription.livemode || id(subscription.customer) !== customerId) throw new Error('INVALID_SUBSCRIPTION');
        await client.query(`INSERT INTO local_stripe_subscriptions (workspace_id,stripe_subscription_id,status,cancel_at_period_end)
          VALUES ($1,$2,$3,$4) ON CONFLICT (workspace_id) DO UPDATE SET stripe_subscription_id=excluded.stripe_subscription_id,status=excluded.status,cancel_at_period_end=excluded.cancel_at_period_end,refreshed_at=now()`, [workspaceId, subscription.id, subscription.status, subscription.cancel_at_period_end]);
        if (invoice && (invoice.billing_reason === 'subscription_create' || invoice.billing_reason === 'subscription_cycle')) {
          // Refuse ambiguous or paginated invoices; do not grant credits on prorations.
          if (invoice.lines.has_more) throw new Error('INVOICE_LINES_INCOMPLETE');
          const matching = invoice.lines.data.filter(line => id(line.pricing?.price_details?.price) === config.priceId && line.parent?.subscription_item_details?.proration === false && line.quantity === 1);
          if (matching.length !== 1) throw new Error('INVOICE_PRICE_MISMATCH');
          await new CreditLedger(pool).grant(workspaceId, `stripe-test-invoice:${invoice.id}`, config.credits, 'SUBSCRIPTION');
        }
        await client.query('INSERT INTO local_stripe_events (event_id,event_type) VALUES ($1,$2)', [event.id, event.type]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return NextResponse.json({ received: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Test event could not be processed' }, { status: 500 }); }
}
