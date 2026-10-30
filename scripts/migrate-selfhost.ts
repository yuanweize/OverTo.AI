import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
import { accountDeployment } from '../src/auth/deployment';
import { migrateSchema } from './migrate-schema';

loadEnvConfig(process.cwd(), true);

async function main() {
  const deployment = accountDeployment(process.env);
  if (deployment?.mode !== 'selfhost') throw new Error('SELFHOST_CONFIG_REQUIRED');
  const pool = new Pool({ connectionString: deployment.databaseUrl, max: 2 });
  try {
    await migrateSchema(pool, deployment.authSecret, true);
    console.log('Self-hosted authentication and application tables ready.');
  } finally { await pool.end(); }
}

main().catch(error => { console.error(error instanceof Error && error.message === 'SELFHOST_CONFIG_REQUIRED' ? error.message : 'SELFHOST_MIGRATION_FAILED'); process.exitCode = 1; });
