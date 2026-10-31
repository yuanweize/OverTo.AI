import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { pool } from '@/auth/server';
import { stripeTestConfig } from '@/billing/stripe-test';
import { CreditLedger } from '@/billing/credit-ledger';
import { verifyTestEvent } from '@/billing/stripe-signature';
import { readRequestBody } from '@/lib/read-request-body';

const id = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id;

interface StripeInvoiceRecord {
  id: string;
  charge?: string | { id: string };
  payment_intent?: string | { id: string };
}

interface StripeExtendedClient {
  paymentIntents?: {
    retrieve(id: string): Promise<{ invoice?: string | { id: string } }>;
  };
  invoices: Stripe['invoices'] & {
    list?(params: { customer: string; limit?: number }): Promise<{ data: StripeInvoiceRecord[] }>;
  };
}

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
  if (event.type !== 'invoice.paid' && event.type !== 'invoice.payment_failed' && !event.type.startsWith('customer.subscription.') && event.type !== 'charge.refunded') {
    return NextResponse.json({ received: true });
  }

  try {
    let customerId: string | undefined;
    let invoice: Stripe.Invoice | undefined;
    let subscriptionId: string | undefined;
    let shouldGrantCredits = false;
    let refundInvoiceId: string | undefined;

    // 1. External Stripe API calls performed strictly OUTSIDE the database transaction
    if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const invoiceId = (event.data.object as Stripe.Invoice).id;
      invoice = await config.stripe.invoices.retrieve(invoiceId);
      customerId = id(invoice.customer);
      subscriptionId = id(invoice.parent?.subscription_details?.subscription);
      if (invoice.livemode || !customerId || !subscriptionId) throw new Error('INVALID_INVOICE');
      if (event.type === 'invoice.paid') {
        if (invoice.status !== 'paid') throw new Error('INVALID_INVOICE');
        if (invoice.billing_reason === 'subscription_create' || invoice.billing_reason === 'subscription_cycle') {
          if (invoice.lines.has_more) throw new Error('INVOICE_LINES_INCOMPLETE');
          const matching = invoice.lines.data.filter(line => id(line.pricing?.price_details?.price) === config.priceId && line.parent?.subscription_item_details?.proration === false && line.quantity === 1);
          if (matching.length !== 1) throw new Error('INVOICE_PRICE_MISMATCH');
          shouldGrantCredits = true;
        }
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      const snapshot = event.data.object as Stripe.Subscription;
      customerId = id(snapshot.customer);
      subscriptionId = snapshot.id;
      if (!customerId || !subscriptionId) throw new Error('INVALID_SUBSCRIPTION');
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      customerId = id(charge.customer);
      refundInvoiceId = id((charge as unknown as { invoice?: string | { id: string } }).invoice);
      if (!customerId) throw new Error('INVALID_CHARGE');

      // Robust invoice mapping: resolve invoice via payment_intent or customer invoice history if not expanded on charge
      const paymentIntentId = id((charge as unknown as { payment_intent?: string | { id: string } }).payment_intent);
      const extendedStripe = config.stripe as unknown as StripeExtendedClient;
      if (!refundInvoiceId && paymentIntentId && extendedStripe.paymentIntents?.retrieve) {
        try {
          const pi = await extendedStripe.paymentIntents.retrieve(paymentIntentId);
          refundInvoiceId = id(pi?.invoice);
        } catch {
          // Ignored, proceed to invoices.list fallback
        }
      }
      if (!refundInvoiceId && customerId && extendedStripe.invoices.list) {
        try {
          const invList = await extendedStripe.invoices.list({ customer: customerId, limit: 5 });
          const matched = (invList?.data || []).find((inv: StripeInvoiceRecord) => id(inv.charge) === charge.id || (paymentIntentId && id(inv.payment_intent) === paymentIntentId));
          if (matched) refundInvoiceId = matched.id;
        } catch {
          // Proceed with best-effort mapping
        }
      }
    }

    const mapping = await pool.query<{ workspace_id: string }>('SELECT workspace_id FROM local_stripe_customers WHERE stripe_customer_id=$1', [customerId]);
    if (!mapping.rowCount) throw new Error('UNMAPPED_CUSTOMER');
    const workspaceId = mapping.rows[0].workspace_id;

    // Fetch latest subscription from Stripe outside DB transaction
    let subscription: Stripe.Subscription | undefined;
    if (subscriptionId) {
      subscription = await config.stripe.subscriptions.retrieve(subscriptionId);
      if (subscription.livemode || id(subscription.customer) !== customerId) throw new Error('INVALID_SUBSCRIPTION');
    }

    // 2. Single atomic local PostgreSQL transaction aligning subscription, ledger, and event logs
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [workspaceId]);
      const seen = await client.query('SELECT event_id FROM local_stripe_events WHERE event_id=$1 FOR UPDATE', [event.id]);
      if (!seen.rowCount) {
        if (subscription) {
          const status = event.type === 'invoice.payment_failed' ? 'past_due' : subscription.status;
          await client.query(`INSERT INTO local_stripe_subscriptions (workspace_id,stripe_subscription_id,status,cancel_at_period_end)
            VALUES ($1,$2,$3,$4) ON CONFLICT (workspace_id) DO UPDATE SET stripe_subscription_id=excluded.stripe_subscription_id,status=excluded.status,cancel_at_period_end=excluded.cancel_at_period_end,refreshed_at=now()`, [workspaceId, subscription.id, status, subscription.cancel_at_period_end]);
        }

        const ledger = new CreditLedger(pool);
        if (shouldGrantCredits && invoice) {
          await ledger.grantInTransaction(client, workspaceId, `stripe-test-invoice:${invoice.id}`, config.credits, 'SUBSCRIPTION');
        } else if (event.type === 'charge.refunded' && refundInvoiceId) {
          const charge = event.data.object as Stripe.Charge;
          const isPartial = typeof charge.amount === 'number' && typeof charge.amount_refunded === 'number' && charge.amount_refunded < charge.amount && charge.amount_refunded > 0;
          if (isPartial) {
            const refundRatio = charge.amount_refunded / charge.amount;
            const clawbackCredits = Math.max(1, Math.round(config.credits * refundRatio));
            await client.query(
              'UPDATE credit_grants SET amount = GREATEST(0, amount - $1) WHERE account_id = $2 AND idempotency_key = $3',
              [clawbackCredits, workspaceId, `stripe-test-invoice:${refundInvoiceId}`]
            );
          } else {
            await ledger.revokeInTransaction(client, workspaceId, `stripe-test-invoice:${refundInvoiceId}`);
          }
        }

        await client.query('INSERT INTO local_stripe_events (event_id,event_type) VALUES ($1,$2)', [event.id, event.type]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return NextResponse.json({ received: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Test event could not be processed' }, { status: 500 });
  }
}
