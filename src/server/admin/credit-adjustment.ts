import type { Pool } from 'pg';
import { CreditLedger } from '@/billing/credit-ledger';

export async function grantAdminCredits(
  pool: Pool,
  input: { actorId: string; userId: string; amount: number; reason: string; requestId: string },
) {
  const { actorId, userId, amount, requestId } = input;
  const reason = input.reason.trim();
  if (!actorId || !userId || !Number.isSafeInteger(amount) || amount < 1 || amount > 10000 ||
      !reason || reason.length > 100 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error('INVALID_INPUT');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Authorization is rechecked in this transaction so a revoked ROOT cannot commit a grant.
    const root = await client.query("SELECT 1 FROM platform_admins WHERE user_id=$1 AND role='ROOT'", [actorId]);
    if (!root.rowCount) throw new Error('FORBIDDEN');
    const target = await client.query<{ workspace_id: string }>(
      'SELECT w.id AS workspace_id FROM "user" u JOIN local_workspaces w ON w.user_id=u.id WHERE u.id=$1', [userId],
    );
    if (!target.rowCount) throw new Error('USER_WORKSPACE_NOT_FOUND');
    const workspaceId = target.rows[0].workspace_id;
    const ledger = new CreditLedger(pool);
    const key = `admin-grant:${actorId}:${requestId}`;
    // The account row lock serializes concurrent retries and balance reads.
    await client.query('SELECT id FROM credit_accounts WHERE id=$1 FOR UPDATE', [workspaceId]);
    const prior = await client.query<{ amount: number; details: { reason?: string } }>(
      `SELECT g.amount, a.details FROM credit_grants g
       LEFT JOIN ai_operations_audit a ON a.actor_id=$2 AND a.action='ADMIN_CREDIT_ADJUSTMENT'
         AND a.target_id=$3 AND a.details->>'idempotencyKey'=g.idempotency_key
       WHERE g.account_id=$1 AND g.idempotency_key=$4`, [workspaceId, actorId, userId, key],
    );
    let created = false;
    if (prior.rowCount) {
      if (prior.rows[0].amount !== amount || prior.rows[0].details?.reason !== reason) throw new Error('IDEMPOTENCY_CONFLICT');
    } else {
      await ledger.grantInTransaction(client, workspaceId, key, amount, 'PROMOTIONAL');
      await client.query(
        `INSERT INTO ai_operations_audit (actor_id, action, target_id, details)
         VALUES ($1, 'ADMIN_CREDIT_ADJUSTMENT', $2, $3)`,
        [actorId, userId, JSON.stringify({ amount, reason, workspaceId, idempotencyKey: key })],
      );
      created = true;
    }
    const balance = await ledger.balanceInTransaction(client, workspaceId);
    await client.query('COMMIT');
    return { created, granted: amount, balance };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
