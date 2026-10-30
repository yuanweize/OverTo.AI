import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
import { migrateSchema } from './migrate-schema';
loadEnvConfig(process.cwd(), true);
async function main() {
  if (process.env.OVERTO_AUTH_LOCAL !== 'true' || !process.env.OVERTO_DEV_DATABASE_URL || !process.env.OVERTO_AUTH_SECRET) throw new Error('Local auth configuration missing');
  const url = new URL(process.env.OVERTO_DEV_DATABASE_URL);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '55443' || url.pathname !== '/overto') throw new Error('Migration restricted to dedicated local development database');
  const pool = new Pool({ connectionString: process.env.OVERTO_DEV_DATABASE_URL });
  try {
    await migrateSchema(pool, process.env.OVERTO_AUTH_SECRET, false);
    console.log('Local authentication and workspace tables ready.');
  } finally { await pool.end(); }
}
main().catch(() => { console.error('Local migration failed.'); process.exitCode = 1; });
