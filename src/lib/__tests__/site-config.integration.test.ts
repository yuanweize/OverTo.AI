// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SiteRepository } from '@/server/config/site-repository';

const connectionString = process.env.SITE_CONFIG_TEST_DATABASE_URL;
// Unique isolated schema; never applies a migration to the operator's public schema.
const schema = `settings_test_${randomUUID().replaceAll('-', '')}`;
describe.skipIf(!connectionString)('transactional administrator settings', () => {
  const control = new Pool({ connectionString });
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
  const repository = new SiteRepository(pool);
  beforeAll(async () => {
    await control.query(`CREATE SCHEMA ${schema}`);
    await pool.query('CREATE TABLE "user" (id text PRIMARY KEY, "emailVerified" boolean NOT NULL)');
    await pool.query(await readFile('migrations/007_platform_settings.sql', 'utf8'));
    await pool.query('INSERT INTO "user" VALUES ($1,true),($2,true)', ['root', 'ordinary']);
    await pool.query("INSERT INTO platform_admins(user_id,role) VALUES ('root','ROOT')");
  });
  afterAll(async () => {
    await pool.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  });
  it('denies ordinary users and leaves settings and audit unchanged', async () => {
    await expect(repository.update('ordinary', 0, { siteName: 'Unauthorized' })).rejects.toThrow('FORBIDDEN');
    expect((await repository.read()).version).toBe(0);
    expect((await pool.query('SELECT * FROM platform_settings_audit')).rowCount).toBe(0);
  });
  it('allows exactly one concurrent edit at the same version and audits its contents', async () => {
    const attempts = await Promise.allSettled(['One', 'Two'].map(siteName => repository.update('root', 0, { siteName })));
    expect(attempts.filter(a => a.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter(a => a.status === 'rejected')).toHaveLength(1);
    const current = await repository.read();
    expect(current.version).toBe(1);
    const audit = await pool.query('SELECT * FROM platform_settings_audit');
    expect(audit.rowCount).toBe(1);
    expect(audit.rows[0].after_config).toEqual(current.config);
  });
  it('requires a currently verified administrator and rolls back rejection', async () => {
    await pool.query('UPDATE "user" SET "emailVerified"=false WHERE id=$1', ['root']);
    await expect(repository.update('root', 1, { siteName: 'Unverified' })).rejects.toThrow('FORBIDDEN');
    expect((await repository.read()).version).toBe(1);
    await pool.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', ['root']);
  });
  it('refuses a second root at the database boundary', async () => {
    await expect(pool.query("INSERT INTO platform_admins(user_id,role) VALUES ('ordinary','ROOT')")).rejects.toThrow();
  });
  it('records restoring a prior configuration as a new version', async () => {
    const old = (await pool.query('SELECT before_config FROM platform_settings_audit WHERE version=1')).rows[0].before_config;
    const restored = await repository.update('root', 1, old);
    expect(restored.version).toBe(2);
    expect(restored.config.siteName).toBe('OvěřTo.AI');
    await expect(repository.update('root', 2, { apiKey: 'never-store' })).rejects.toThrow('UNKNOWN_SETTING');
    expect((await repository.read()).version).toBe(2);
    expect((await pool.query('SELECT * FROM platform_settings_audit')).rowCount).toBe(2);
  });
});
