import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { pool } from '@/auth/server';
import { stripeTestConfig } from '@/billing/stripe-test';
import { CreditLedger } from '@/billing/credit-ledger';
import { verifyTestEvent } from '@/billing/stripe-signature';
import { readRequestBody } from '@/lib/read-request-body';
import type { PoolClient } from 'pg';

const id = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id;

async function applyRefundReversal(client: PoolClient, ledger: CreditLedger, workspaceId: string, invoiceId: string, targetCredits: number) {
  if (targetCredits <= 0) return;
  const grantKey = `stripe-test-invoice:${invoiceId}`;
  const grant = await client.query<{ id: string }>('SELECT id FROM credit_grants WHERE account_id=$1 AND idempotency_key=$2', [workspaceId, grantKey]);
  if (!grant.rowCount) return;
  const applied = await client.query<{ amount: number }>('SELECT COALESCE(SUM(amount),0)::int AS amount FROM credit_reversals WHERE grant_id=$1', [grant.rows[0].id]);
  const delta = targetCredits - applied.rows[0].amount;
  if (delta > 0) await ledger.reverseInTransaction(client, workspaceId, `stripe-test-refund:${invoiceId}:${targetCredits}`, grantKey, delta, 'STRIPE_REFUND');
}

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
          const invoiceKey = `stripe-test-invoice:${invoice.id}`;
          await ledger.grantInTransaction(client, workspaceId, invoiceKey, config.credits, 'SUBSCRIPTION');
          // A refund can arrive before invoice.paid. Reconcile its recorded target now.
          const pending = await client.query<{ cumulative_retracted_credits: number }>(
            'SELECT cumulative_retracted_credits FROM local_stripe_refund_tracking WHERE workspace_id=$1 AND invoice_id=$2',
            [workspaceId, invoice.id],
          );
          if (pending.rowCount) await applyRefundReversal(client, ledger, workspaceId, invoice.id, pending.rows[0].cumulative_retracted_credits);
        } else if (event.type === 'charge.refunded' && refundInvoiceId) {
          const charge = event.data.object as Stripe.Charge;
          if (!Number.isSafeInteger(charge.amount) || charge.amount <= 0 ||
              !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 ||
              charge.amount_refunded > charge.amount) throw new Error('INVALID_REFUND_AMOUNT');
          const targetCredits = Math.min(config.credits, Math.round(config.credits * charge.amount_refunded / charge.amount));
          const tracking = await client.query<{ cumulative_retracted_credits: number }>(
            `INSERT INTO local_stripe_refund_tracking
               (workspace_id, invoice_id, charge_id, total_amount, cumulative_amount_refunded, cumulative_retracted_credits, last_event_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (workspace_id, invoice_id) DO UPDATE SET
               cumulative_amount_refunded=GREATEST(local_stripe_refund_tracking.cumulative_amount_refunded,EXCLUDED.cumulative_amount_refunded),
               cumulative_retracted_credits=GREATEST(local_stripe_refund_tracking.cumulative_retracted_credits,EXCLUDED.cumulative_retracted_credits),
               last_event_id=CASE WHEN EXCLUDED.cumulative_amount_refunded>local_stripe_refund_tracking.cumulative_amount_refunded THEN EXCLUDED.last_event_id ELSE local_stripe_refund_tracking.last_event_id END,
               updated_at=now()
             WHERE local_stripe_refund_tracking.charge_id=EXCLUDED.charge_id AND local_stripe_refund_tracking.total_amount=EXCLUDED.total_amount
             RETURNING cumulative_retracted_credits`,
            [workspaceId, refundInvoiceId, charge.id, charge.amount, charge.amount_refunded, targetCredits, event.id],
          );
          if (!tracking.rowCount) throw new Error('REFUND_CHARGE_CONFLICT');
          await applyRefundReversal(client, ledger, workspaceId, refundInvoiceId, tracking.rows[0].cumulative_retracted_credits);
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
