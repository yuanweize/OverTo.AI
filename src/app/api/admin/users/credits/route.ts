import { pool } from '@/auth/server';
import { getPlatformAdmin } from '@/server/config/admin';
import { CreditLedger } from '@/billing/credit-ledger';
import { readRequestBody } from '@/lib/read-request-body';
import { isAllowedOrigin } from '@/server/security/origin';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  if (!pool) return Response.json({ error: 'UNAVAILABLE' }, { status: 503 });
  if (!isAllowedOrigin(request.headers.get('origin'))) {
    return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  }

  const admin = await getPlatformAdmin(request.headers);
  if (!admin) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });

  let body: { userId?: string; amount?: number; reason?: string };
  try {
    const raw = await readRequestBody(request, 4096);
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return Response.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const { userId, amount, reason } = body;
  if (!userId || typeof userId !== 'string' || !Number.isSafeInteger(amount) || !amount || amount < 1 || amount > 10000 || typeof reason !== 'string' || !reason.trim()) {
    return Response.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query('SELECT u.id, u.email, w.id AS workspace_id FROM "user" u LEFT JOIN local_workspaces w ON w.user_id = u.id WHERE u.id = $1', [userId]);
    if (!userRes.rowCount || !userRes.rows[0].workspace_id) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'USER_WORKSPACE_NOT_FOUND' }, { status: 404 });
    }

    const workspaceId = userRes.rows[0].workspace_id;
    const ledger = new CreditLedger(pool);
    const idempotencyKey = `admin-grant:${randomUUID()}`;
    await ledger.grant(workspaceId, idempotencyKey, amount, 'PROMOTIONAL');

    await client.query(
      `INSERT INTO ai_operations_audit (actor_id, action, target_id, details)
       VALUES ($1, 'ADMIN_CREDIT_ADJUSTMENT', $2, $3)`,
      [admin.id, userId, JSON.stringify({ amount, reason: reason.trim(), workspaceId })]
    );

    const balance = await ledger.balance(workspaceId);
    await client.query('COMMIT');

    return Response.json({ success: true, granted: amount, balance }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    await client.query('ROLLBACK');
    return Response.json({ error: 'CREDIT_ADJUSTMENT_FAILED' }, { status: 500 });
  } finally {
    client.release();
  }
}
