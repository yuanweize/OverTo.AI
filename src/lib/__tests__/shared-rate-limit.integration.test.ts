// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SharedRateLimiter } from '@/server/security/shared-rate-limit';
const connectionString = process.env.SITE_CONFIG_TEST_DATABASE_URL;
describe.skipIf(!connectionString)('shared PostgreSQL rate admission', () => {
  const schema = `rate_test_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString });
  const firstPool = new Pool({ connectionString, options: `-c search_path=${schema}`, max: 15 });
  const secondPool = new Pool({ connectionString, options: `-c search_path=${schema}`, max: 15 });
  const first = new SharedRateLimiter(firstPool), second = new SharedRateLimiter(secondPool);
  beforeAll(async () => { await control.query(`CREATE SCHEMA ${schema}`); await firstPool.query(await readFile('migrations/009_shared_rate_limits.sql','utf8')); });
  afterAll(async () => { await firstPool.end(); await secondPool.end(); await control.query(`DROP SCHEMA ${schema} CASCADE`); await control.end(); });
  it('enforces one shared limit across two independent clients under concurrency', async () => {
    const requests = await Promise.all(Array.from({ length: 30 }, (_, index) => (index % 2 ? first : second).consume([{ bucket: 'shared', limit: 7, windowSeconds: 86400 }])));
    expect(requests.filter(request => request.allowed)).toHaveLength(7);
    expect(requests.filter(request => !request.allowed)).toHaveLength(23);
    expect((await firstPool.query("SELECT sum(requests)::integer AS total FROM shared_rate_limits WHERE bucket='shared'")).rows[0].total).toBe(7);
  });
  it('rolls back partial scope consumption when another scope is exhausted', async () => {
    await first.consume([{ bucket: 'z-full', limit: 1, windowSeconds: 86400 }]);
    expect((await second.consume([{ bucket: 'a-free', limit: 10, windowSeconds: 86400 }, { bucket: 'z-full', limit: 1, windowSeconds: 86400 }])).allowed).toBe(false);
    expect((await firstPool.query("SELECT * FROM shared_rate_limits WHERE bucket='a-free'")).rowCount).toBe(0);
  });
  it('keeps project buckets independent and validates policy bounds', async () => {
    expect((await first.consume([{ bucket: 'another-project', limit: 1, windowSeconds: 60 }])).allowed).toBe(true);
    await expect(first.consume([{ bucket: 'invalid', limit: 0, windowSeconds: 60 }])).rejects.toThrow('INVALID_RATE_POLICY');
  });
});
