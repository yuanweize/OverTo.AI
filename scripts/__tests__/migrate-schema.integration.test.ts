// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { migrateSchema } from '../migrate-schema';

const connectionString = process.env.SITE_CONFIG_TEST_DATABASE_URL;

describe.skipIf(!connectionString)('schema migration idempotency', () => {
  const schema = `migration_test_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString });
  let pool: Pool;

  beforeAll(async () => {
    await control.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
  });

  afterAll(async () => {
    if (pool) await pool.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  });

  it('runs initial migration and then rerun without errors (idempotent)', async () => {
    const secret = 'a'.repeat(48);
    // First run
    await migrateSchema(pool, secret, true);

    const tablesFirst = await pool.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename",
      [schema]
    );
    expect(tablesFirst.rows.length).toBeGreaterThan(5);

    // Second run (should be completely idempotent and succeed)
    await expect(migrateSchema(pool, secret, true)).resolves.not.toThrow();

    const tablesSecond = await pool.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename",
      [schema]
    );
    expect(tablesSecond.rows).toEqual(tablesFirst.rows);
  });
});
