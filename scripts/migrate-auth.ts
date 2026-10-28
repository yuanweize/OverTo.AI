import { loadEnvConfig } from '@next/env';
import { getMigrations } from 'better-auth/db/migration';
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
loadEnvConfig(process.cwd(), true);
async function main() {
  if (process.env.OVERTO_AUTH_LOCAL !== 'true' || !process.env.OVERTO_DEV_DATABASE_URL || !process.env.OVERTO_AUTH_SECRET) throw new Error('Local auth configuration missing');
  const url = new URL(process.env.OVERTO_DEV_DATABASE_URL);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '55443' || url.pathname !== '/overto') throw new Error('Migration restricted to dedicated local development database');
  const pool = new Pool({ connectionString: process.env.OVERTO_DEV_DATABASE_URL });
  try {
    const auth = betterAuth({ database: pool, secret: process.env.OVERTO_AUTH_SECRET, emailAndPassword: { enabled: true, minPasswordLength: 10 } });
    const migration = await getMigrations(auth.options);
    await migration.runMigrations();
    await pool.query(await readFile('migrations/002_local_workspace.sql', 'utf8'));
    const existing = await pool.query("SELECT to_regclass('public.credit_accounts') AS name");
    if (!existing.rows[0].name) await pool.query(await readFile('migrations/001_credit_ledger.sql', 'utf8'));
    await pool.query(await readFile('migrations/003_local_usage.sql', 'utf8'));
    await pool.query(await readFile('migrations/004_local_api_keys.sql', 'utf8'));
    console.log('Local authentication and workspace tables ready.');
  } finally { await pool.end(); }
}
main().catch(() => { console.error('Local migration failed.'); process.exitCode = 1; });
