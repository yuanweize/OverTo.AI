import { getMigrations } from 'better-auth/db/migration';
import { betterAuth } from 'better-auth';
import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';

/** Applies only additive/idempotent project migrations; caller selects the database. */
export async function migrateSchema(pool: Pool, secret: string, distributedAuthRateLimit: boolean) {
  const lock = await pool.connect();
  try {
    await lock.query("SELECT pg_advisory_lock(hashtext('overto_schema_migrations'))");
    const auth = betterAuth({
      database: pool,
      secret,
      baseURL: 'http://127.0.0.1:3000',
      emailAndPassword: { enabled: true, minPasswordLength: 10 },
      ...(distributedAuthRateLimit ? { rateLimit: { enabled: true, storage: 'database' as const, window: 60, max: 60 } } : {}),
    });
    await (await getMigrations(auth.options)).runMigrations();
    const existing = await pool.query("SELECT to_regclass('credit_accounts') AS name");
    if (!existing.rows[0].name) await pool.query(await readFile('migrations/001_credit_ledger.sql', 'utf8'));
    await pool.query(await readFile('migrations/002_local_workspace.sql', 'utf8'));
    const files = [
      '003_local_usage.sql', '004_local_api_keys.sql', '005_local_project_archive.sql',
      '006_stripe_test.sql', '007_platform_settings.sql', '008_ai_traces.sql',
      '009_shared_rate_limits.sql', '010_ai_prompts.sql', '011_prompt_test_metrics.sql',
      '012_ai_evaluations.sql', '013_ai_provider_settings.sql', '014_key_permissions.sql',
      '015_provider_identity.sql', '016_ai_budget_reservations.sql',
      '017_ai_budget_accounting.sql', '018_stripe_refund_tracking.sql', '019_verified_ai_pricing.sql',
      '020_credit_reversals.sql', '021_billing_catalog.sql',
    ];
    for (const file of files) await pool.query(await readFile(`migrations/${file}`, 'utf8'));
  } finally {
    try { await lock.query("SELECT pg_advisory_unlock(hashtext('overto_schema_migrations'))"); }
    finally { lock.release(); }
  }
}
