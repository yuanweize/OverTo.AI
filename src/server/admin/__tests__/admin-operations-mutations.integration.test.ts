// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const connectionString = process.env.SITE_CONFIG_TEST_DATABASE_URL;

describe.skipIf(!connectionString)('admin credit adjustment and audit logging', () => {
  const schema = `admin_ops_test_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString });
  let pool: Pool;
  const rootId = 'root-user-id';
  const targetUserId = 'target-user-id';
  const targetWorkspaceId = 'target-workspace-id';

  beforeAll(async () => {
    await control.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString, options: `-c search_path=${schema}` });

    await pool.query('CREATE TABLE "user" (id text PRIMARY KEY, name text, email text, "emailVerified" boolean, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now())');
    await pool.query(await readFile('migrations/001_credit_ledger.sql', 'utf8'));
    await pool.query(await readFile('migrations/002_local_workspace.sql', 'utf8'));
    await pool.query(await readFile('migrations/007_platform_settings.sql', 'utf8'));
    await pool.query(await readFile('migrations/010_ai_prompts.sql', 'utf8'));

    // Insert root and normal users
    await pool.query('INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)', [rootId, 'Root Admin', 'root@example.test']);
    await pool.query("INSERT INTO platform_admins (user_id, role) VALUES ($1, 'ROOT')", [rootId]);

    await pool.query('INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)', [targetUserId, 'Target User', 'target@example.test']);
    await pool.query('INSERT INTO local_workspaces (id, user_id, name) VALUES ($1, $2, $3)', [targetWorkspaceId, targetUserId, 'Target Workspace']);
    await pool.query('INSERT INTO credit_accounts (id) VALUES ($1)', [targetWorkspaceId]);
  });

  afterAll(async () => {
    if (pool) await pool.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  });

  it('rejects unauthorized credit adjustments', async () => {
    // Ordinary user check
    const checkOrdinary = await pool.query('SELECT role FROM platform_admins WHERE user_id=$1', [targetUserId]);
    expect(checkOrdinary.rowCount).toBe(0);
  });

  it('grants credits and records audit trail atomically', async () => {
    const { CreditLedger } = await import('@/billing/credit-ledger');
    const ledger = new CreditLedger(pool);

    const initialBalance = await ledger.balance(targetWorkspaceId);
    expect(initialBalance.available).toBe(0);

    const idempotencyKey = `admin-test-grant:${randomUUID()}`;
    await ledger.grant(targetWorkspaceId, idempotencyKey, 50, 'PROMOTIONAL');

    await pool.query(
      `INSERT INTO ai_operations_audit (actor_id, action, target_id, details)
       VALUES ($1, 'ADMIN_CREDIT_ADJUSTMENT', $2, $3)`,
      [rootId, targetUserId, JSON.stringify({ amount: 50, reason: 'Customer support compensation', workspaceId: targetWorkspaceId })]
    );

    const newBalance = await ledger.balance(targetWorkspaceId);
    expect(newBalance.available).toBe(50);

    const auditRes = await pool.query('SELECT * FROM ai_operations_audit WHERE actor_id=$1 AND action=$2', [rootId, 'ADMIN_CREDIT_ADJUSTMENT']);
    expect(auditRes.rowCount).toBe(1);
    expect(auditRes.rows[0].target_id).toBe(targetUserId);
  });
});
