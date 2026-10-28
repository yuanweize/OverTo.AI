import 'server-only';
import { pool } from './server';
import { CreditLedger } from '@/billing/credit-ledger';

/** Provision idempotently after a locally authenticated session. */
export async function personalWorkspace(userId: string) {
  if (!pool) throw new Error('ACCOUNTS_UNAVAILABLE');
  const workspaceId = `personal:${userId}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO local_workspaces (id,user_id,name) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO NOTHING', [workspaceId, userId, 'Osobní prostor']);
    await client.query('INSERT INTO local_projects (id,workspace_id,name) VALUES ($1,$2,$3) ON CONFLICT (workspace_id,name) DO NOTHING', [`default:${userId}`, workspaceId, 'Výchozí projekt']);
    await client.query('INSERT INTO credit_accounts (id) VALUES ($1) ON CONFLICT DO NOTHING', [workspaceId]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  const ledger = new CreditLedger(pool);
  await ledger.grant(workspaceId, 'local-trial-v1', 10, 'PROMOTIONAL');
  const balance = await ledger.balance(workspaceId);
  const projects = await pool.query<{ id: string; name: string }>('SELECT id,name FROM local_projects WHERE workspace_id=$1 ORDER BY created_at', [workspaceId]);
  const usage = await pool.query<{ mode: string; provider_status: string; credits: number; created_at: Date }>('SELECT mode,provider_status,credits,created_at FROM local_usage_events WHERE account_id=$1 ORDER BY created_at DESC LIMIT 50', [workspaceId]);
  return { workspaceId, balance, projects: projects.rows, usage: usage.rows };
}
