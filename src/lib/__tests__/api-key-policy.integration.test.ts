// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { ApiKeyRepository, validateKeyPolicy } from '@/server/api-keys/repository';
import { SharedRateLimiter } from '@/server/security/shared-rate-limit';

const connectionString = process.env.SITE_CONFIG_TEST_DATABASE_URL;
describe.skipIf(!connectionString)('project API key policy', () => {
  const schema = `key_test_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString });
  const pool = new Pool({ connectionString, max: 16, options: `-c search_path=${schema}` });
  const secondPool = new Pool({ connectionString, max: 16, options: `-c search_path=${schema}` });
  const keys = new ApiKeyRepository(pool);
  const owner = randomUUID(), workspace = randomUUID(), project = randomUUID();
  const outsider = randomUUID(), outsiderWorkspace = randomUUID(), outsiderProject = randomUUID();

  beforeAll(async () => {
    const url = new URL(connectionString!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/overto_test') throw Error('Requires disposable local overto_test');
    await control.query(`CREATE SCHEMA ${schema}`);
    await pool.query('CREATE TABLE "user" (id text PRIMARY KEY)');
    await pool.query(await readFile('migrations/002_local_workspace.sql', 'utf8'));
    await pool.query(await readFile('migrations/004_local_api_keys.sql', 'utf8'));
    await pool.query(await readFile('migrations/005_local_project_archive.sql', 'utf8'));
    await pool.query(await readFile('migrations/014_key_permissions.sql', 'utf8'));
    await pool.query(await readFile('migrations/009_shared_rate_limits.sql', 'utf8'));
    await pool.query('INSERT INTO "user"(id) VALUES ($1),($2)', [owner, outsider]);
    await pool.query('INSERT INTO local_workspaces(id,user_id,name) VALUES ($1,$2,$3),($4,$5,$6)', [workspace, owner, 'Owner', outsiderWorkspace, outsider, 'Other']);
    await pool.query('INSERT INTO local_projects(id,workspace_id,name) VALUES ($1,$2,$3),($4,$5,$6)', [project, workspace, 'Project', outsiderProject, outsiderWorkspace, 'Other']);
  });
  afterAll(async () => {
    await pool.end(); await secondPool.end();
    await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await control.end();
  });

  it('rejects invalid policy and cross-account project creation', async () => {
    for (const policy of [{ scopes: [] }, { scopes: ['analysis:ai', 'analysis:ai'] }, { expiresDays: 91 }, { dailyRequestLimit: 0 }]) {
      expect(() => validateKeyPolicy(policy)).toThrow('INVALID_KEY_POLICY');
    }
    await expect(keys.create(workspace, outsiderProject, 'Forbidden', validateKeyPolicy({}))).rejects.toThrow('NOT_FOUND');
    expect((await pool.query('SELECT count(*)::int AS count FROM local_api_keys')).rows[0].count).toBe(0);
  });

  it('rotates atomically, retains scopes and shared quota, and isolates owners', async () => {
    const original = await keys.create(workspace, project, 'Automation', validateKeyPolicy({ scopes: ['analysis:rules'], expiresDays: 7, dailyRequestLimit: 3 }));
    expect(original.metadata.scopes).toEqual(['analysis:rules']);
    await expect(keys.rotate(outsiderWorkspace, original.metadata.id)).rejects.toThrow('NOT_FOUND');
    const rotated = await Promise.allSettled([keys.rotate(workspace, original.metadata.id), keys.rotate(workspace, original.metadata.id)]);
    expect(rotated.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(rotated.filter(x => x.status === 'rejected')).toHaveLength(1);
    const successor = (rotated.find(x => x.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof keys.rotate>>>).value;
    expect(successor.key).not.toBe(original.key);
    expect(successor.metadata.scopes).toEqual(['analysis:rules']);
    expect(successor.metadata.daily_request_limit).toBe(3);
    const rows = (await pool.query('SELECT id,quota_id,revoked_at,expires_at FROM local_api_keys ORDER BY created_at,id')).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0].quota_id).toBe(rows[1].quota_id);
    expect(rows.find(row => row.id === original.metadata.id)?.revoked_at).not.toBeNull();
    expect(rows.find(row => row.id === successor.metadata.id)?.revoked_at).toBeNull();
    expect(new Date(successor.metadata.expires_at).toISOString()).toBe(new Date(original.metadata.expires_at).toISOString());

    const rateA = new SharedRateLimiter(pool), rateB = new SharedRateLimiter(secondPool);
    const attempts = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? rateA : rateB).consume([
      { bucket: `key-day:${rows[0].quota_id}`, limit: 3, windowSeconds: 86400 },
      { bucket: 'workspace-test', limit: 4, windowSeconds: 86400 },
      { bucket: 'project-test', limit: 4, windowSeconds: 86400 },
    ])));
    expect(attempts.filter(x => x.allowed)).toHaveLength(3);
    expect((await pool.query('SELECT requests FROM shared_rate_limits WHERE bucket=$1', [`key-day:${rows[0].quota_id}`])).rows[0].requests).toBe(3);
    expect((await rateB.consume([{ bucket: 'other-owner-key', limit: 1, windowSeconds: 86400 }])).allowed).toBe(true);
  });
});
