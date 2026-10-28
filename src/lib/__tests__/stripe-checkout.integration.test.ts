import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({ pool: null as unknown, config: null as unknown, verified: true }));
vi.mock('server-only', () => ({}));
vi.mock('@/auth/server', () => ({ get pool() { return state.pool; }, auth: { api: { getSession: async () => ({ user: { id: 'user-synthetic', emailVerified: state.verified } }) } } }));
vi.mock('@/auth/workspace', () => ({ personalWorkspace: async () => ({ workspaceId: 'workspace-synthetic' }) }));
vi.mock('@/billing/stripe-test', () => ({ stripeTestConfig: () => state.config }));
import { POST } from '@/app/api/local/stripe/checkout/route';

const connectionString = process.env.LEDGER_TEST_DATABASE_URL;
describe.skipIf(!connectionString)('Stripe test checkout with PostgreSQL and a simulated provider', () => {
  const schema = `stripe_checkout_${randomUUID().replaceAll('-', '')}`;
  let admin: Pool; let pool: Pool;
  const create = vi.fn(async (...args: unknown[]) => { void args; return { id: 'cs_test_synthetic', livemode: false, url: 'https://checkout.stripe.com/c/pay/synthetic' }; });
  const provider = { prices: { retrieve: vi.fn(async () => ({ livemode: false, active: true, type: 'recurring', recurring: { interval: 'month', interval_count: 1 } })) }, customers: { create: vi.fn(async () => ({ id: 'cus_synthetic', livemode: false })) }, subscriptions: { list: vi.fn(async () => ({ data: [], has_more: false })) }, checkout: { sessions: { create } } };
  function request(requestId: string, origin = 'http://127.0.0.1:3005') { return new NextRequest('http://127.0.0.1/api/local/stripe/checkout', { method: 'POST', headers: { Origin: origin, 'Idempotency-Key': requestId } }); }
  beforeAll(async () => {
    const url = new URL(connectionString!); if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/overto_test') throw new Error('Requires a disposable local overto_test database');
    admin = new Pool({ connectionString }); await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
    await pool.query('CREATE TABLE "user" (id text PRIMARY KEY)'); await pool.query(await readFile('migrations/002_local_workspace.sql', 'utf8')); await pool.query(await readFile('migrations/006_stripe_test.sql', 'utf8'));
    await pool.query('INSERT INTO "user" (id) VALUES ($1)', ['user-synthetic']); await pool.query('INSERT INTO local_workspaces (id,user_id,name) VALUES ($1,$2,$3)', ['workspace-synthetic', 'user-synthetic', 'Synthetic']);
    state.pool = pool; state.config = { stripe: provider, priceId: 'price_synthetic', credits: 10 }; process.env.BETTER_AUTH_URL = 'http://127.0.0.1:3005';
  });
  afterAll(async () => { if (pool) await pool.end(); if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); } });
  it('rejects unverified users and cross-origin requests', async () => {
    state.verified = false; expect((await POST(request(randomUUID()))).status).toBe(401); state.verified = true;
    expect((await POST(request(randomUUID(), 'https://example.com'))).status).toBe(503); expect(create).not.toHaveBeenCalled();
  });
  it('persists an attempt and reuses its Stripe idempotency key on retry', async () => {
    const requestId = randomUUID();
    expect((await POST(request(requestId))).status).toBe(200);
    expect((await POST(request(randomUUID()))).status).toBe(409);
    expect((await POST(request(requestId))).status).toBe(200);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][1]).toEqual(create.mock.calls[1][1]);
    expect((await pool.query('SELECT count(*)::int AS n FROM local_stripe_checkout_attempts')).rows[0].n).toBe(1);
  });
});
