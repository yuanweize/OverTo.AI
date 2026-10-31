// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { hashPassword } from 'better-auth/crypto';
import { NextRequest } from 'next/server';

const testDbUrl =
  process.env.TEST_DATABASE_URL ||
  process.env.SITE_CONFIG_TEST_DATABASE_URL ||
  process.env.DATABASE_URL;

const testUserId = randomUUID();
const testEmail = `user-${randomUUID()}@example.com`;
const correctPassword = 'StrongPassword123!';
let mockPool: Pool;
const mockSessionUser: { id: string; email: string; emailVerified: boolean } = { id: testUserId, email: testEmail, emailVerified: true };

vi.mock('@/auth/server', () => ({
  get pool() { return mockPool; },
  auth: {
    api: {
      getSession: async () => (mockSessionUser ? { user: mockSessionUser } : null),
    },
  },
}));

describe.skipIf(!testDbUrl)('account lifecycle: re-authentication, GDPR export, and cascading deletion', () => {
  const schema = `account_life_${randomUUID().replaceAll('-', '')}`;
  let control: Pool;
  let pool: Pool;
  let deleteRoute: (req: NextRequest) => Promise<Response>;
  let exportRoute: (req: NextRequest) => Promise<Response>;

  let workspaceId: string;

  beforeAll(async () => {
    control = new Pool({ connectionString: testDbUrl });
    await control.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString: testDbUrl, options: `-c search_path=${schema}` });
    mockPool = pool;

    process.env.BETTER_AUTH_URL = 'http://127.0.0.1:3000';
    process.env.OVERTO_PUBLIC_URL = 'http://127.0.0.1:3000';

    // Load auth and app schemas
    await pool.query(`
      CREATE TABLE "user" (
        id text PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL UNIQUE,
        "emailVerified" boolean NOT NULL DEFAULT true,
        image text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE "account" (
        id text PRIMARY KEY,
        "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        "accountId" text NOT NULL,
        "providerId" text NOT NULL,
        password text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE "session" (
        id text PRIMARY KEY,
        "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        token text NOT NULL UNIQUE,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "ipAddress" text,
        "userAgent" text
      );
    `);

    await pool.query(await readFile('migrations/001_credit_ledger.sql', 'utf8'));
    await pool.query(await readFile('migrations/002_local_workspace.sql', 'utf8'));
    await pool.query(await readFile('migrations/003_local_usage.sql', 'utf8'));
    await pool.query(await readFile('migrations/004_local_api_keys.sql', 'utf8'));
    await pool.query(await readFile('migrations/005_local_project_archive.sql', 'utf8'));
    await pool.query(await readFile('migrations/006_stripe_test.sql', 'utf8'));
    await pool.query(await readFile('migrations/007_platform_settings.sql', 'utf8'));
    await pool.query(await readFile('migrations/009_shared_rate_limits.sql', 'utf8'));
    await pool.query(await readFile('migrations/014_key_permissions.sql', 'utf8'));

    // Insert user, password hash, and active session
    const hashedPassword = await hashPassword(correctPassword);
    await pool.query(
      'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)',
      [testUserId, 'Test User', testEmail]
    );
    await pool.query(
      'INSERT INTO "account" (id, "userId", "accountId", "providerId", password) VALUES ($1, $2, $3, $4, $5)',
      [randomUUID(), testUserId, testEmail, 'credential', hashedPassword]
    );
    await pool.query(
      'INSERT INTO "session" (id, "userId", token, "expiresAt") VALUES ($1, $2, $3, now() + interval \'1 day\')',
      [randomUUID(), testUserId, 'test-session-token']
    );

    // Create personal workspace & dummy resources
    workspaceId = `personal:${testUserId}`;
    await pool.query(
      'INSERT INTO local_workspaces (id, user_id, name) VALUES ($1, $2, $3)',
      [workspaceId, testUserId, 'Test Personal Workspace']
    );
    await pool.query('INSERT INTO credit_accounts (id) VALUES ($1) ON CONFLICT DO NOTHING', [workspaceId]);
    await pool.query('INSERT INTO credit_grants (account_id, idempotency_key, amount, category) VALUES ($1, $2, 50, \'PROMOTIONAL\')', [workspaceId, randomUUID()]);

    const projectId = randomUUID();
    await pool.query('INSERT INTO local_projects (id, workspace_id, name) VALUES ($1, $2, $3)', [projectId, workspaceId, 'Project Alpha']);

    const keyId = randomUUID();
    await pool.query('INSERT INTO local_api_keys (id, workspace_id, project_id, name, key_hash, key_prefix, scopes, expires_at, quota_id) VALUES ($1, $2, $3, $4, $5, $6, $7, now() + interval \'30 days\', $8)',
      [keyId, workspaceId, projectId, 'Key 1', 'fakehash', 'ov_test_123', '{"read","analyze"}', keyId]);

    const resRow = await pool.query<{ id: string }>(
      "INSERT INTO credit_reservations (account_id, idempotency_key, amount, status, ttl_seconds, expires_at) VALUES ($1, 'test-res-1', 1, 'CONSUMED', 300, now() + interval '300 seconds') RETURNING id",
      [workspaceId]
    );
    await pool.query(
      'INSERT INTO local_usage_events (account_id, reservation_id, project_id, mode, provider_status, credits, duration_ms) VALUES ($1, $2, $3, $4, $5, $6, 45)',
      [workspaceId, resRow.rows[0].id, projectId, 'RULES', 'SUCCESS', 1]
    );
    await pool.query('INSERT INTO local_stripe_customers (workspace_id, stripe_customer_id) VALUES ($1, $2)',
      [workspaceId, 'cus_test_12345']);

    // Import routes after environment and database options are set
    const deleteMod = await import('../delete/route');
    const exportMod = await import('../export/route');
    deleteRoute = deleteMod.POST;
    exportRoute = exportMod.GET;
  });

  afterAll(async () => {
    if (pool) await pool.end().catch(() => {});
    if (control) {
      await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
      await control.end().catch(() => {});
    }
  });

  it('rejects deletion when password is wrong', async () => {
    const req = new NextRequest('http://127.0.0.1:3000/api/account/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:3000',
      },
      body: JSON.stringify({
        confirmEmail: testEmail,
        password: 'WrongPassword!',
      }),
    });

    const res = await deleteRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('heslo');

    // Verify user is NOT deleted
    const user = await pool.query('SELECT id FROM "user" WHERE id=$1', [testUserId]);
    expect(user.rowCount).toBe(1);
  });

  it('rejects deletion when email confirmation string does not match', async () => {
    const req = new NextRequest('http://127.0.0.1:3000/api/account/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:3000',
      },
      body: JSON.stringify({
        confirmEmail: 'someone-else@example.com',
        password: correctPassword,
      }),
    });

    const res = await deleteRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('E-mail');
  });

  it('rejects deletion when request origin is forged', async () => {
    const req = new NextRequest('http://127.0.0.1:3000/api/account/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil-cross-site.com',
      },
      body: JSON.stringify({
        confirmEmail: testEmail,
        password: correctPassword,
      }),
    });

    const res = await deleteRoute(req);
    expect(res.status).toBe(403);
  });

  it('successfully exports complete account data without Origin header (standard browser fetch)', async () => {
    // Real browsers do not send Origin on same-origin GET
    const req = new NextRequest('http://127.0.0.1:3000/api/account/export', {
      method: 'GET',
    });

    const res = await exportRoute(req);
    expect(res.status).toBe(200);
    const exportJson = await res.json();

    expect(exportJson.user.email).toBe(testEmail);
    expect(exportJson.workspace.id).toBe(workspaceId);
    expect(exportJson.projects.length).toBeGreaterThanOrEqual(1);
    expect(exportJson.apiKeys).toHaveLength(1);
    expect(exportJson.usageEvents).toHaveLength(1);
    expect(exportJson.credits.available).toBeGreaterThanOrEqual(50);
    expect(exportJson.dataRetentionNotice.scope).toContain('Complete export');
  });

  it('rejects cross-site export attempts with 403', async () => {
    const maliciousOriginReq = new NextRequest('http://127.0.0.1:3000/api/account/export', {
      method: 'GET',
      headers: { Origin: 'http://malicious-attacker.com' },
    });
    const resOrigin = await exportRoute(maliciousOriginReq);
    expect(resOrigin.status).toBe(403);

    const crossSiteReq = new NextRequest('http://127.0.0.1:3000/api/account/export', {
      method: 'GET',
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    });
    const resSec = await exportRoute(crossSiteReq);
    expect(resSec.status).toBe(403);
  });

  it('successfully deletes account upon correct re-authentication, revokes keys, and anonymizes financial customer records', async () => {
    const req = new NextRequest('http://127.0.0.1:3000/api/account/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:3000',
      },
      body: JSON.stringify({
        confirmEmail: testEmail,
        password: correctPassword,
      }),
    });

    const res = await deleteRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);

    // Verify cascading deletions
    const userCheck = await pool.query('SELECT id FROM "user" WHERE id=$1', [testUserId]);
    expect(userCheck.rowCount).toBe(0);

    const sessionCheck = await pool.query('SELECT id FROM "session" WHERE "userId"=$1', [testUserId]);
    expect(sessionCheck.rowCount).toBe(0);

    const keysCheck = await pool.query('SELECT id FROM local_api_keys WHERE workspace_id=$1', [workspaceId]);
    expect(keysCheck.rowCount).toBe(0);

    const projectsCheck = await pool.query('SELECT id FROM local_projects WHERE workspace_id=$1', [workspaceId]);
    expect(projectsCheck.rowCount).toBe(0);

    // Verify all tenant and customer bindings are removed
    const stripeCheck = await pool.query('SELECT stripe_customer_id FROM local_stripe_customers WHERE workspace_id=$1', [workspaceId]);
    expect(stripeCheck.rowCount).toBe(0);

    const creditCheck = await pool.query('SELECT id FROM credit_accounts WHERE id=$1', [workspaceId]);
    expect(creditCheck.rowCount).toBe(0);

    const workspaceCheck = await pool.query('SELECT id FROM local_workspaces WHERE id=$1', [workspaceId]);
    expect(workspaceCheck.rowCount).toBe(0);
  });
});
