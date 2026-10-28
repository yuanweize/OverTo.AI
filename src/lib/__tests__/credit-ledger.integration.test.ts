import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { CreditLedger } from '@/billing/credit-ledger';

// Requires a dedicated disposable PostgreSQL database. No existing database is modified.
const connectionString = process.env.LEDGER_TEST_DATABASE_URL;
describe.skipIf(!connectionString)('PostgreSQL credit ledger', () => {
  const pool = new Pool({ connectionString, max: 24 });
  const ledger = new CreditLedger(pool);
  const account = randomUUID();
  beforeAll(async () => {
    await pool.query(await readFile('migrations/001_credit_ledger.sql', 'utf8'));
    await pool.query('INSERT INTO credit_accounts (id) VALUES ($1)', [account]);
  });
  afterAll(async () => { await pool.end(); });

  it('grants once and rejects altered replays', async () => {
    await Promise.all(Array.from({ length: 5 }, () => ledger.grant(account, 'trial', 10, 'PROMOTIONAL')));
    await expect(ledger.grant(account, 'trial', 11, 'PROMOTIONAL')).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    expect((await ledger.balance(account)).available).toBe(10);
  });
  it('serializes concurrent reservations and does not overspend', async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => ledger.reserve(account, `request-${i}`, 1, 60)));
    expect(attempts.filter(a => a.status === 'fulfilled')).toHaveLength(10);
    expect(attempts.filter(a => a.status === 'rejected')).toHaveLength(10);
    expect(await ledger.balance(account)).toMatchObject({ available: 0, reserved: 10 });
  });
  it('settles once, releases failures and rejects conflicting retries', async () => {
    const reservations = await pool.query<{ idempotency_key: string }>("SELECT idempotency_key FROM credit_reservations WHERE account_id = $1 AND status = 'RESERVED' ORDER BY id", [account]);
    const [first, second] = reservations.rows.map(r => r.idempotency_key);
    await Promise.all(Array.from({ length: 5 }, () => ledger.settle(account, first, 1)));
    await expect(ledger.settle(account, first, 0)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    await ledger.settle(account, second, 0);
    expect(await ledger.balance(account)).toMatchObject({ available: 1, consumed: 1, reserved: 8 });
  });
  it('recovers expired reservations and prevents late settlement', async () => {
    const reserved = await ledger.reserve(account, 'expires', 1, 60);
    await pool.query("UPDATE credit_reservations SET expires_at = now() - interval '1 second' WHERE id = $1", [reserved.id]);
    expect((await ledger.balance(account)).available).toBe(1);
    await expect(ledger.settle(account, 'expires', 1)).rejects.toThrow('RESERVATION_EXPIRED');
    expect((await ledger.reserve(account, 'expires', 1, 60)).status).toBe('EXPIRED');
  });
  it('keeps accounts isolated and refuses unauthorised over-settlement', async () => {
    const other = randomUUID();
    await pool.query('INSERT INTO credit_accounts (id) VALUES ($1)', [other]);
    await expect(ledger.settle(other, 'request-0', 1)).rejects.toThrow('RESERVATION_NOT_FOUND');
    await ledger.grant(other, 'grant', 2, 'PURCHASED');
    await ledger.reserve(other, 'request', 1, 60);
    await expect(ledger.reserve(other, 'request', 1, 61)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    await expect(ledger.settle(other, 'request', 2)).rejects.toThrow('EXCEEDS_RESERVATION');
    expect((await ledger.balance(other)).available).toBe(1);
  });
});
