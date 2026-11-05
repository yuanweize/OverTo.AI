// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { grantAdminCredits } from '@/server/admin/credit-adjustment';

const connectionString = process.env.SITE_CONFIG_TEST_DATABASE_URL;

describe.skipIf(!connectionString)('admin credit adjustment and audit logging', () => {
  const schema = `admin_ops_test_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString });
  let pool: Pool;
  const rootId = 'root-user-id';
  const targetUserId = 'target-user-id';
  const targetWorkspaceId = 'target-workspace-id';

  beforeAll(async () => {
    const url = new URL(connectionString!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/overto_test') throw new Error('Requires a disposable local overto_test database');
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
    await expect(grantAdminCredits(pool, { actorId: targetUserId, userId: targetUserId, amount: 10, reason: 'Unauthorized', requestId: randomUUID() })).rejects.toThrow('FORBIDDEN');
  });

  it('grants once for concurrent retries and records one audit entry', async () => {
    const { CreditLedger } = await import('@/billing/credit-ledger');
    const ledger = new CreditLedger(pool);
    const input = { actorId: rootId, userId: targetUserId, amount: 50, reason: 'Customer support compensation', requestId: randomUUID() };
    const results = await Promise.all(Array.from({ length: 4 }, () => grantAdminCredits(pool, input)));
    expect(results.filter(result => result.created)).toHaveLength(1);
    expect((await ledger.balance(targetWorkspaceId)).available).toBe(50);
    const auditRes = await pool.query('SELECT * FROM ai_operations_audit WHERE actor_id=$1 AND action=$2', [rootId, 'ADMIN_CREDIT_ADJUSTMENT']);
    expect(auditRes.rowCount).toBe(1);
    expect(auditRes.rows[0].target_id).toBe(targetUserId);
    expect(auditRes.rows[0].details.reason).toBe(input.reason);
    await expect(grantAdminCredits(pool, { ...input, amount: 51 })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    await expect(grantAdminCredits(pool, { ...input, reason: 'Changed' })).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  });

  it('rolls back the grant when audit insertion fails', async () => {
    const requestId = randomUUID();
    await pool.query("ALTER TABLE ai_operations_audit ADD CONSTRAINT simulated_audit_failure CHECK (action != 'ADMIN_CREDIT_ADJUSTMENT') NOT VALID");
    try {
      await expect(grantAdminCredits(pool, { actorId: rootId, userId: targetUserId, amount: 25, reason: 'Fault injection', requestId })).rejects.toThrow();
      const grants = await pool.query('SELECT id FROM credit_grants WHERE idempotency_key=$1', [`admin-grant:${rootId}:${requestId}`]);
      expect(grants.rowCount).toBe(0);
      expect((await new (await import('@/billing/credit-ledger')).CreditLedger(pool).balance(targetWorkspaceId)).available).toBe(50);
    } finally {
      await pool.query('ALTER TABLE ai_operations_audit DROP CONSTRAINT simulated_audit_failure');
    }
  });
});
