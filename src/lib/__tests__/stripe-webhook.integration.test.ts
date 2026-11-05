import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import Stripe from 'stripe';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({ pool: null as unknown, config: null as unknown }));
vi.mock('server-only', () => ({}));
vi.mock('@/auth/server', () => ({ get pool() { return state.pool; } }));
vi.mock('@/billing/stripe-test', () => ({ stripeTestConfig: () => state.config }));
import { POST } from '@/app/api/local/stripe/webhook/route';

const connectionString = process.env.LEDGER_TEST_DATABASE_URL;
describe.skipIf(!connectionString)('Stripe test webhook with PostgreSQL and a simulated provider', () => {
  const schema = `stripe_test_${randomUUID().replaceAll('-', '')}`;
  let admin: Pool; let pool: Pool;
  const stripe = new Stripe('sk_test_synthetic_only'); const secret = 'whsec_synthetic_only';
  const workspace = 'workspace-synthetic'; const customer = 'cus_synthetic'; const subscription = 'sub_synthetic';
  const invoice = { id: 'in_synthetic', livemode: false, status: 'paid', customer, parent: { subscription_details: { subscription } }, billing_reason: 'subscription_cycle', lines: { has_more: false, data: [{ pricing: { price_details: { price: 'price_synthetic' } }, parent: { subscription_item_details: { proration: false } }, quantity: 1 }] } };
  const provider = { webhooks: stripe.webhooks, invoices: { retrieve: vi.fn(async () => invoice) }, subscriptions: { retrieve: vi.fn(async () => ({ id: subscription, customer, livemode: false, status: 'active', cancel_at_period_end: false })) } };
  function request(eventId: string, live = false, signed = true, type = 'invoice.paid', data: unknown = { object: { id: invoice.id, object: 'invoice' } }) {
    const payload = JSON.stringify({ id: eventId, object: 'event', type, livemode: live, data });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: signed ? secret : 'whsec_other' });
    return new NextRequest('http://127.0.0.1/api/local/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': signature }, body: payload });
  }
  beforeAll(async () => {
    const url = new URL(connectionString!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/overto_test') throw new Error('Requires a disposable local overto_test database');
    admin = new Pool({ connectionString });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
    await pool.query('CREATE TABLE "user" (id text PRIMARY KEY)');
    await pool.query(await readFile('migrations/001_credit_ledger.sql', 'utf8'));
    await pool.query(await readFile('migrations/020_credit_reversals.sql', 'utf8'));
    await pool.query(await readFile('migrations/002_local_workspace.sql', 'utf8'));
    await pool.query(await readFile('migrations/006_stripe_test.sql', 'utf8'));
    await pool.query('INSERT INTO "user" (id) VALUES ($1)', ['user-synthetic']);
    await pool.query('INSERT INTO local_workspaces (id,user_id,name) VALUES ($1,$2,$3)', [workspace, 'user-synthetic', 'Synthetic']);
    await pool.query('INSERT INTO credit_accounts (id) VALUES ($1)', [workspace]);
    await pool.query('INSERT INTO local_stripe_customers (workspace_id,stripe_customer_id) VALUES ($1,$2)', [workspace, customer]);
    state.pool = pool; state.config = { stripe: provider, webhookSecret: secret, priceId: 'price_synthetic', credits: 10 };
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); } });
  async function effectiveCredits(invoiceId: string): Promise<number | null> {
    const result = await pool.query<{ available: number }>(
      `SELECT g.amount-COALESCE(SUM(r.amount),0)::int AS available FROM credit_grants g
       LEFT JOIN credit_reversals r ON r.grant_id=g.id
       WHERE g.idempotency_key=$1 GROUP BY g.id`, [`stripe-test-invoice:${invoiceId}`],
    );
    return result.rows[0]?.available ?? null;
  }

  it('rejects invalid signatures and live events before changing credits', async () => {
    expect((await POST(request('evt_bad', false, false))).status).toBe(400);
    expect((await POST(request('evt_live', true))).status).toBe(400);
    expect((await pool.query('SELECT count(*)::int AS n FROM credit_grants')).rows[0].n).toBe(0);
  });
  it('processes concurrent duplicate deliveries once and uses current subscription state', async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => POST(request('evt_repeat'))));
    expect(responses.map(response => response.status)).toEqual([200, 200, 200, 200, 200]);
    expect((await pool.query('SELECT count(*)::int AS n, sum(amount)::int AS amount FROM credit_grants')).rows[0]).toEqual({ n: 1, amount: 10 });
    expect((await pool.query('SELECT count(*)::int AS n FROM local_stripe_events')).rows[0].n).toBe(1);
    expect((await pool.query('SELECT status FROM local_stripe_subscriptions')).rows[0].status).toBe('active');
  });
  it('does not grant the same invoice twice across different event IDs', async () => {
    const responses = await Promise.all([POST(request('evt_second')), POST(request('evt_third'))]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect((await pool.query('SELECT count(*)::int AS n, sum(amount)::int AS amount FROM credit_grants')).rows[0]).toEqual({ n: 1, amount: 10 });
    expect((await pool.query('SELECT count(*)::int AS n FROM local_stripe_events')).rows[0].n).toBe(3);
  });
  it('rejects a different invoice event when its configured price does not match', async () => {
    state.config = { stripe: provider, webhookSecret: secret, priceId: 'price_other', credits: 10 };
    expect((await POST(request('evt_price_mismatch'))).status).toBe(500);
    expect((await pool.query('SELECT count(*)::int AS n FROM credit_grants')).rows[0].n).toBe(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM local_stripe_events')).rows[0].n).toBe(3);
  });

  it('updates subscription to past_due on invoice.payment_failed', async () => {
    state.config = { stripe: provider, webhookSecret: secret, priceId: 'price_synthetic', credits: 10 };
    const res = await POST(request('evt_failed_invoice', false, true, 'invoice.payment_failed'));
    expect(res.status).toBe(200);
    const sub = await pool.query('SELECT status FROM local_stripe_subscriptions WHERE workspace_id=$1', [workspace]);
    expect(sub.rows[0].status).toBe('past_due');
  });

  it('updates subscription state on customer.subscription.updated', async () => {
    state.config = { stripe: provider, webhookSecret: secret, priceId: 'price_synthetic', credits: 10 };
    provider.subscriptions.retrieve = vi.fn(async () => ({ id: subscription, customer, livemode: false, status: 'canceled', cancel_at_period_end: true }));
    const res = await POST(request('evt_sub_update', false, true, 'customer.subscription.updated', {
      object: {
        id: subscription,
        customer,
      },
    }));
    expect(res.status).toBe(200);
    const sub = await pool.query('SELECT status, cancel_at_period_end FROM local_stripe_subscriptions WHERE workspace_id=$1', [workspace]);
    expect(sub.rows[0].status).toBe('canceled');
    expect(sub.rows[0].cancel_at_period_end).toBe(true);
  });

  it('preserves the original grant and reverses credits on charge.refunded', async () => {
    state.config = { stripe: provider, webhookSecret: secret, priceId: 'price_synthetic', credits: 10 };
    expect((await pool.query('SELECT count(*)::int AS n FROM credit_grants WHERE idempotency_key=$1', [`stripe-test-invoice:${invoice.id}`])).rows[0].n).toBe(1);
    const res = await POST(request('evt_refund_test', false, true, 'charge.refunded', {
      object: {
        id: 'ch_synthetic_1',
        customer,
        invoice: invoice.id,
        amount: 2000,
        amount_refunded: 2000,
      },
    }));
    expect(res.status).toBe(200);
    expect((await pool.query('SELECT count(*)::int AS n FROM credit_grants WHERE idempotency_key=$1', [`stripe-test-invoice:${invoice.id}`])).rows[0].n).toBe(1);
    expect(await effectiveCredits(invoice.id)).toBe(0);
  });

  it('handles partial refund and resolves invoice via fallback when charge.invoice is missing', async () => {
    state.config = { stripe: provider, webhookSecret: secret, priceId: 'price_synthetic', credits: 10 };

    // Grant 10 credits under a new test invoice
    const partialInvId = 'in_partial_refund_test';
    await pool.query(
      "INSERT INTO credit_grants (account_id, idempotency_key, category, amount, created_at) VALUES ($1, $2, 'SUBSCRIPTION', 10, now())",
      [workspace, `stripe-test-invoice:${partialInvId}`]
    );

    // Mock customer invoices list fallback
    (provider.invoices as unknown as { list: unknown }).list = vi.fn(async () => ({
      data: [{ id: partialInvId, charge: 'ch_partial_1', customer }],
    }));

    // Send 50% partial refund without explicit invoice field on charge object
    const res = await POST(request('evt_partial_refund', false, true, 'charge.refunded', {
      object: {
        id: 'ch_partial_1',
        customer,
        amount: 2000,
        amount_refunded: 1000, // 50%
      },
    }));

    expect(res.status).toBe(200);
    const grantRow = await pool.query<{ amount: number }>(
      'SELECT amount FROM credit_grants WHERE idempotency_key=$1',
      [`stripe-test-invoice:${partialInvId}`]
    );
    expect(grantRow.rowCount).toBe(1);
    expect(grantRow.rows[0].amount).toBe(10);
    expect(await effectiveCredits(partialInvId)).toBe(5);
  });

  it('comprehensive partial refund lifecycle: multiple refunds, duplicate states, out-of-order, and full refund', async () => {
    state.config = { stripe: provider, webhookSecret: secret, priceId: 'price_synthetic', credits: 10 };
    const multiInvId = 'in_multi_refund_test';
    const chargeId = 'ch_multi_test';

    // 1. Initial grant of 10 credits for $100 (10000 cents) charge
    await pool.query(
      "INSERT INTO credit_grants (account_id, idempotency_key, category, amount, created_at) VALUES ($1, $2, 'SUBSCRIPTION', 10, now())",
      [workspace, `stripe-test-invoice:${multiInvId}`]
    );

    // 2. First partial refund: 20% ($20 / 2000 cents)
    const res1 = await POST(request('evt_refund_step_1', false, true, 'charge.refunded', {
      object: {
        id: chargeId,
        customer,
        invoice: multiInvId,
        amount: 10000,
        amount_refunded: 2000,
      },
    }));
    expect(res1.status).toBe(200);

    let grant = await pool.query<{ amount: number }>('SELECT amount FROM credit_grants WHERE idempotency_key=$1', [`stripe-test-invoice:${multiInvId}`]);
    expect(grant.rows[0].amount).toBe(10);
    expect(await effectiveCredits(multiInvId)).toBe(8);

    // 3. Duplicate delivery of first partial refund (same event ID)
    const res1Dup = await POST(request('evt_refund_step_1', false, true, 'charge.refunded', {
      object: { id: chargeId, customer, invoice: multiInvId, amount: 10000, amount_refunded: 2000 },
    }));
    expect(res1Dup.status).toBe(200);
    grant = await pool.query<{ amount: number }>('SELECT amount FROM credit_grants WHERE idempotency_key=$1', [`stripe-test-invoice:${multiInvId}`]);
    expect(await effectiveCredits(multiInvId)).toBe(8);

    // 4. Different event ID with the SAME refund state (amount_refunded = 2000)
    const res1DiffEvt = await POST(request('evt_refund_step_1_diff_id', false, true, 'charge.refunded', {
      object: { id: chargeId, customer, invoice: multiInvId, amount: 10000, amount_refunded: 2000 },
    }));
    expect(res1DiffEvt.status).toBe(200);
    grant = await pool.query<{ amount: number }>('SELECT amount FROM credit_grants WHERE idempotency_key=$1', [`stripe-test-invoice:${multiInvId}`]);
    expect(await effectiveCredits(multiInvId)).toBe(8);

    // 5. Second partial refund: cumulative 50% ($50 / 5000 cents total refunded)
    const res2 = await POST(request('evt_refund_step_2', false, true, 'charge.refunded', {
      object: {
        id: chargeId,
        customer,
        invoice: multiInvId,
        amount: 10000,
        amount_refunded: 5000,
      },
    }));
    expect(res2.status).toBe(200);
    grant = await pool.query<{ amount: number }>('SELECT amount FROM credit_grants WHERE idempotency_key=$1', [`stripe-test-invoice:${multiInvId}`]);
    expect(await effectiveCredits(multiInvId)).toBe(5);

    // 6. Out-of-order event: older refund event (amount_refunded = 3000) arrives late
    const resOutOfOrder = await POST(request('evt_refund_out_of_order', false, true, 'charge.refunded', {
      object: {
        id: chargeId,
        customer,
        invoice: multiInvId,
        amount: 10000,
        amount_refunded: 3000, // < 5000 already accounted for
      },
    }));
    expect(resOutOfOrder.status).toBe(200);
    grant = await pool.query<{ amount: number }>('SELECT amount FROM credit_grants WHERE idempotency_key=$1', [`stripe-test-invoice:${multiInvId}`]);
    expect(await effectiveCredits(multiInvId)).toBe(5);

    // 7. Full refund: final 100% refund ($100 / 10000 cents)
    const res3 = await POST(request('evt_refund_step_3_full', false, true, 'charge.refunded', {
      object: {
        id: chargeId,
        customer,
        invoice: multiInvId,
        amount: 10000,
        amount_refunded: 10000,
      },
    }));
    expect(res3.status).toBe(200);
    const grantAfterFull = await pool.query('SELECT count(*)::int AS n FROM credit_grants WHERE idempotency_key=$1', [`stripe-test-invoice:${multiInvId}`]);
    expect(grantAfterFull.rows[0].n).toBe(1);
    expect(await effectiveCredits(multiInvId)).toBe(0);

    // Verify refund tracking record reflects final state
    const tracking = await pool.query<{ cumulative_amount_refunded: number; cumulative_retracted_credits: number }>(
      'SELECT cumulative_amount_refunded, cumulative_retracted_credits FROM local_stripe_refund_tracking WHERE workspace_id=$1 AND invoice_id=$2',
      [workspace, multiInvId]
    );
    expect(tracking.rows[0].cumulative_amount_refunded).toBe(10000);
    expect(tracking.rows[0].cumulative_retracted_credits).toBe(10);

    // Stripe may redeliver the paid invoice under another event ID after the refund.
    provider.invoices.retrieve = vi.fn(async () => ({ ...invoice, id: multiInvId }));
    expect((await POST(request('evt_paid_after_full_refund', false, true, 'invoice.paid', { object: { id: multiInvId } }))).status).toBe(200);
    expect(await effectiveCredits(multiInvId)).toBe(0);
    provider.invoices.retrieve = vi.fn(async () => invoice);
  });

  it('reconciles a full refund delivered before the paid invoice', async () => {
    const lateInvoiceId = 'in_refund_before_paid';
    const refund = await POST(request('evt_refund_before_paid', false, true, 'charge.refunded', {
      object: { id: 'ch_refund_before_paid', customer, invoice: lateInvoiceId, amount: 2000, amount_refunded: 2000 },
    }));
    expect(refund.status).toBe(200);
    expect(await effectiveCredits(lateInvoiceId)).toBeNull();
    provider.invoices.retrieve = vi.fn(async () => ({ ...invoice, id: lateInvoiceId }));
    const paid = await POST(request('evt_late_paid', false, true, 'invoice.paid', { object: { id: lateInvoiceId } }));
    expect(paid.status).toBe(200);
    expect(await effectiveCredits(lateInvoiceId)).toBe(0);
    provider.invoices.retrieve = vi.fn(async () => invoice);
  });

  it('uses the stored grant when the configured monthly allowance changes', async () => {
    const driftInvoiceId = 'in_allowance_drift';
    await pool.query("INSERT INTO credit_grants(account_id,idempotency_key,category,amount) VALUES($1,$2,'SUBSCRIPTION',10)", [workspace, `stripe-test-invoice:${driftInvoiceId}`]);
    state.config = { stripe: provider, webhookSecret: secret, priceId: 'price_synthetic', credits: 20 };
    const response = await POST(request('evt_allowance_drift', false, true, 'charge.refunded', {
      object: { id: 'ch_allowance_drift', customer, invoice: driftInvoiceId, amount: 2000, amount_refunded: 2000 },
    }));
    expect(response.status).toBe(200);
    expect(await effectiveCredits(driftInvoiceId)).toBe(0);
    const tracking = await pool.query('SELECT cumulative_retracted_credits FROM local_stripe_refund_tracking WHERE invoice_id=$1', [driftInvoiceId]);
    expect(tracking.rows[0].cumulative_retracted_credits).toBe(10);
    state.config = { stripe: provider, webhookSecret: secret, priceId: 'price_synthetic', credits: 10 };
  });

  it('ensures atomic rollback: no credits or events are committed if transaction fails midway', async () => {
    state.config = { stripe: provider, webhookSecret: secret, priceId: 'price_synthetic', credits: 10 };
    provider.subscriptions.retrieve = vi.fn(async () => ({ id: subscription, customer, livemode: false, status: 'active', cancel_at_period_end: false }));
    
    // Add a check constraint to simulate a database failure during event logging
    await pool.query("ALTER TABLE local_stripe_events ADD CONSTRAINT test_simulated_fail CHECK (event_id != 'evt_atomic_fail')");

    const grantsBefore = (await pool.query('SELECT count(*)::int AS n FROM credit_grants')).rows[0].n;

    // Create a new invoice ID to attempt grant
    const failInvoice = { ...invoice, id: 'in_atomic_fail' };
    provider.invoices.retrieve = vi.fn(async () => failInvoice);

    const res = await POST(request('evt_atomic_fail', false, true, 'invoice.paid', { object: { id: 'in_atomic_fail', object: 'invoice' } }));
    expect(res.status).toBe(500);

    // Verify atomic rollback: no credits were added and no events were committed
    const grantsAfter = (await pool.query('SELECT count(*)::int AS n FROM credit_grants')).rows[0].n;
    expect(grantsAfter).toBe(grantsBefore);

    const eventCheck = await pool.query('SELECT event_id FROM local_stripe_events WHERE event_id=$1', ['evt_atomic_fail']);
    expect(eventCheck.rowCount).toBe(0);

    // Clean up test constraint
    await pool.query('ALTER TABLE local_stripe_events DROP CONSTRAINT test_simulated_fail');
  });
});
