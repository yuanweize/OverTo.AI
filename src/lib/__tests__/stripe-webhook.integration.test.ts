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
    await pool.query(await readFile('migrations/002_local_workspace.sql', 'utf8'));
    await pool.query(await readFile('migrations/006_stripe_test.sql', 'utf8'));
    await pool.query('INSERT INTO "user" (id) VALUES ($1)', ['user-synthetic']);
    await pool.query('INSERT INTO local_workspaces (id,user_id,name) VALUES ($1,$2,$3)', [workspace, 'user-synthetic', 'Synthetic']);
    await pool.query('INSERT INTO credit_accounts (id) VALUES ($1)', [workspace]);
    await pool.query('INSERT INTO local_stripe_customers (workspace_id,stripe_customer_id) VALUES ($1,$2)', [workspace, customer]);
    state.pool = pool; state.config = { stripe: provider, webhookSecret: secret, priceId: 'price_synthetic', credits: 10 };
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); } });
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

  it('revokes credit grants on charge.refunded', async () => {
    state.config = { stripe: provider, webhookSecret: secret, priceId: 'price_synthetic', credits: 10 };
    expect((await pool.query('SELECT count(*)::int AS n FROM credit_grants WHERE idempotency_key=$1', [`stripe-test-invoice:${invoice.id}`])).rows[0].n).toBe(1);
    const res = await POST(request('evt_refund_test', false, true, 'charge.refunded', {
      object: {
        id: 'ch_synthetic_1',
        customer,
        invoice: invoice.id,
      },
    }));
    expect(res.status).toBe(200);
    expect((await pool.query('SELECT count(*)::int AS n FROM credit_grants WHERE idempotency_key=$1', [`stripe-test-invoice:${invoice.id}`])).rows[0].n).toBe(0);
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
