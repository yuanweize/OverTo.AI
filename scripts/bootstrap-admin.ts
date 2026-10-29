/** Trusted local CLI only. Grants the first root to an existing verified account. */
import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
loadEnvConfig(process.cwd(), true);
async function main() {
  const email = process.argv[2]?.trim();
  if (!email || !process.env.OVERTO_DEV_DATABASE_URL) throw new Error('USAGE');
  const url = new URL(process.env.OVERTO_DEV_DATABASE_URL);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '55443' || url.pathname !== '/overto') throw new Error('LOCAL_ONLY');
  const pool = new Pool({ connectionString: process.env.OVERTO_DEV_DATABASE_URL });
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
main().catch(error => { console.error(error instanceof Error && ['USAGE','LOCAL_ONLY','ALREADY_INITIALIZED','VERIFIED_ACCOUNT_REQUIRED'].includes(error.message) ? error.message : 'BOOTSTRAP_FAILED'); process.exitCode = 1; });
