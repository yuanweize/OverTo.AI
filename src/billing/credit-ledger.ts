import type { Pool, PoolClient } from 'pg';

type Category = 'PROMOTIONAL' | 'SUBSCRIPTION' | 'PURCHASED';
type Reservation = { id: string; amount: number; status: 'RESERVED' | 'CONSUMED' | 'RELEASED' | 'EXPIRED'; settled_amount: number | null };
type LocalUsage = { projectId: string; mode: 'RULES' | 'AI'; providerStatus: string; model: string | null; durationMs: number };

/** Internal experimental ledger. Callers must authorize account access before invoking it. */
export class CreditLedger {
  constructor(private readonly pool: Pool) {}

  private async locked<T>(accountId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const account = await client.query('SELECT id FROM credit_accounts WHERE id = $1 FOR UPDATE', [accountId]);
      if (!account.rowCount) throw new Error('ACCOUNT_NOT_FOUND');
      await client.query("UPDATE credit_reservations SET status = 'EXPIRED' WHERE account_id = $1 AND status = 'RESERVED' AND expires_at <= now()", [accountId]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async grant(accountId: string, key: string, amount: number, category: Category): Promise<void> {
    await this.locked(accountId, async client => {
      await this.grantInTransaction(client, accountId, key, amount, category);
    });
  }

  async grantInTransaction(client: PoolClient, accountId: string, key: string, amount: number, category: Category): Promise<void> {
    requireKey(key); requireAmount(amount);
    if (!['PROMOTIONAL', 'SUBSCRIPTION', 'PURCHASED'].includes(category)) throw new Error('INVALID_CATEGORY');
    const account = await client.query('SELECT id FROM credit_accounts WHERE id = $1 FOR UPDATE', [accountId]);
    if (!account.rowCount) throw new Error('ACCOUNT_NOT_FOUND');
    const previous = await client.query('SELECT amount, category FROM credit_grants WHERE account_id = $1 AND idempotency_key = $2', [accountId, key]);
    if (previous.rowCount) {
      if (previous.rows[0].amount !== amount || previous.rows[0].category !== category) throw new Error('IDEMPOTENCY_CONFLICT');
      return;
    }
    await client.query('INSERT INTO credit_grants (account_id, idempotency_key, amount, category) VALUES ($1,$2,$3,$4)', [accountId, key, amount, category]);
  }

  async revokeInTransaction(client: PoolClient, accountId: string, key: string): Promise<boolean> {
    requireKey(key);
    const account = await client.query('SELECT id FROM credit_accounts WHERE id = $1 FOR UPDATE', [accountId]);
    if (!account.rowCount) throw new Error('ACCOUNT_NOT_FOUND');
    const deleted = await client.query('DELETE FROM credit_grants WHERE account_id = $1 AND idempotency_key = $2', [accountId, key]);
    return (deleted.rowCount ?? 0) > 0;
  }

  async balance(accountId: string): Promise<{ granted: number; consumed: number; reserved: number; available: number }> {
    return this.locked(accountId, async client => this.balanceInTransaction(client, accountId));
  }

  private async balanceInTransaction(client: PoolClient, accountId: string) {
    const result = await client.query(`SELECT
      COALESCE((SELECT SUM(amount) FROM credit_grants WHERE account_id = $1), 0)::int AS granted,
      COALESCE((SELECT SUM(amount) FROM credit_transactions WHERE account_id = $1), 0)::int AS consumed,
      COALESCE((SELECT SUM(amount) FROM credit_reservations WHERE account_id = $1 AND status = 'RESERVED'), 0)::int AS reserved`, [accountId]);
    const { granted, consumed, reserved } = result.rows[0];
    return { granted, consumed, reserved, available: granted - consumed - reserved };
  }

  async reserve(accountId: string, key: string, amount: number, ttlSeconds: number): Promise<Reservation & { created: boolean }> {
    requireKey(key); requireAmount(amount);
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 3600) throw new Error('INVALID_TTL');
    return this.locked(accountId, async client => {
      const previous = await client.query<Reservation & { ttl_seconds: number }>('SELECT id, amount, status, settled_amount, ttl_seconds FROM credit_reservations WHERE account_id = $1 AND idempotency_key = $2', [accountId, key]);
      if (previous.rowCount) {
        if (previous.rows[0].amount !== amount || previous.rows[0].ttl_seconds !== ttlSeconds) throw new Error('IDEMPOTENCY_CONFLICT');
        return { ...previous.rows[0], created: false };
      }
      if ((await this.balanceInTransaction(client, accountId)).available < amount) throw new Error('INSUFFICIENT_CREDITS');
      const result = await client.query<Reservation>(`INSERT INTO credit_reservations (account_id, idempotency_key, amount, ttl_seconds, expires_at)
        VALUES ($1, $2, $3, $4::integer, now() + $4::integer * interval '1 second') RETURNING id, amount, status, settled_amount`, [accountId, key, amount, ttlSeconds]);
      return { ...result.rows[0], created: true };
    });
  }

  async settle(accountId: string, key: string, actualAmount: number, usage?: LocalUsage): Promise<Reservation> {
    requireKey(key);
    if (!Number.isSafeInteger(actualAmount) || actualAmount < 0) throw new Error('INVALID_AMOUNT');
    return this.locked(accountId, async client => {
      const found = await client.query<Reservation>('SELECT id, amount, status, settled_amount FROM credit_reservations WHERE account_id = $1 AND idempotency_key = $2', [accountId, key]);
      const reservation = found.rows[0];
      if (!reservation) throw new Error('RESERVATION_NOT_FOUND');
      if (reservation.status === 'CONSUMED' || reservation.status === 'RELEASED') {
        if (reservation.settled_amount !== actualAmount) throw new Error('IDEMPOTENCY_CONFLICT');
        return reservation;
      }
      if (reservation.status !== 'RESERVED') throw new Error('RESERVATION_EXPIRED');
      if (actualAmount > reservation.amount) throw new Error('EXCEEDS_RESERVATION');
      if (actualAmount > 0) await client.query('INSERT INTO credit_transactions (account_id, reservation_id, amount) VALUES ($1,$2,$3)', [accountId, reservation.id, actualAmount]);
      if (usage) await client.query(`INSERT INTO local_usage_events (account_id, reservation_id, project_id, mode, provider_status, model, duration_ms, credits)
        SELECT $1,$2,p.id,$4,$5,$6,$7,$8 FROM local_projects p WHERE p.id=$3 AND p.workspace_id=$1`, [accountId, reservation.id, usage.projectId, usage.mode, usage.providerStatus, usage.model, usage.durationMs, actualAmount]).then(result => { if (result.rowCount !== 1) throw new Error('PROJECT_NOT_FOUND'); });
      const updated = await client.query<Reservation>("UPDATE credit_reservations SET status = $1, settled_amount = $2 WHERE id = $3 RETURNING id, amount, status, settled_amount", [actualAmount ? 'CONSUMED' : 'RELEASED', actualAmount, reservation.id]);
      return updated.rows[0];
    });
  }
}
function requireKey(key: string) { if (typeof key !== 'string' || !key.trim() || key.length > 200) throw new Error('INVALID_KEY'); }
function requireAmount(amount: number) { if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000) throw new Error('INVALID_AMOUNT'); }
