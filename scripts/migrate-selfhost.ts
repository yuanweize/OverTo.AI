import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
import { accountDeployment } from '../src/auth/deployment';
import { migrateSchema } from './migrate-schema';

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');

export function getMigrationCredentials(env: NodeJS.ProcessEnv): { databaseUrl: string; authSecret: string } {
  // If accountDeployment is fully configured and valid, use its verified properties
  try {
    const deployment = accountDeployment(env);
    if (deployment?.mode === 'selfhost') {
      return { databaseUrl: deployment.databaseUrl, authSecret: deployment.authSecret };
    }
  } catch {
    // If accountDeployment threw due to unconfigured SMTP or URL, continue to direct database migration credentials
  }

  // Standalone database migration credentials (e.g. Render pre-deploy or Docker container startup)
  const isSelfHosted = env.OVERTO_SELF_HOSTED === 'true' || env.NODE_ENV === 'production';
  if (!isSelfHosted) throw new Error('SELFHOST_CONFIG_REQUIRED');
  if (env.NODE_ENV === 'production' && env.OVERTO_AUTH_LOCAL === 'true') throw new Error('INVALID_SELFHOST_CONFIG');

  const databaseUrl = env.OVERTO_DATABASE_URL || env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL_REQUIRED');

  const database = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname) {
    throw new Error('INVALID_DATABASE_URL');
  }

  const authSecret = env.OVERTO_AUTH_SECRET || env.BETTER_AUTH_SECRET;
  if (!authSecret || authSecret.length < 32) throw new Error('AUTH_SECRET_REQUIRED');

  return { databaseUrl, authSecret };
}

async function main() {
  const { databaseUrl, authSecret } = getMigrationCredentials(process.env);
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    await migrateSchema(pool, authSecret, true);
    console.log('Self-hosted authentication and application tables ready.');
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(
    error instanceof Error && error.message === 'SELFHOST_CONFIG_REQUIRED'
      ? error.message
      : `SELFHOST_MIGRATION_FAILED: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});

