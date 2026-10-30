/** Trusted CLI only. Grants the first root to an existing verified account. */
import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
import { accountDeployment } from '../src/auth/deployment';
loadEnvConfig(process.cwd(), true);
async function main() {
  const email = process.argv[2]?.trim();
  if (!email) throw new Error('USAGE');
  const deployment = accountDeployment({ ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' });
  if (!deployment) throw new Error('ACCOUNT_DEPLOYMENT_REQUIRED');
  const pool = new Pool({ connectionString: deployment.databaseUrl });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE platform_admins IN EXCLUSIVE MODE');
    if ((await client.query('SELECT 1 FROM platform_admins')).rowCount) throw new Error('ALREADY_INITIALIZED');
    const user = await client.query('SELECT id FROM "user" WHERE lower(email)=lower($1) AND "emailVerified"=true', [email]);
    if (user.rowCount !== 1) throw new Error('VERIFIED_ACCOUNT_REQUIRED');
    await client.query('INSERT INTO platform_admins(user_id,role) VALUES ($1,$2)', [user.rows[0].id, 'ROOT']);
    await client.query('COMMIT');
    console.log('First platform administrator initialized. Bootstrap is now closed.');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error(error instanceof Error && ['USAGE','ACCOUNT_DEPLOYMENT_REQUIRED','ALREADY_INITIALIZED','VERIFIED_ACCOUNT_REQUIRED'].includes(error.message) ? error.message : 'BOOTSTRAP_FAILED'); process.exitCode = 1; });
