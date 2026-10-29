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
    await client.query('INSERT INTO local_workspaces (id,user_id,name) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [workspaceId, userId, 'Osobní prostor']);
    await client.query('INSERT INTO local_projects (id,workspace_id,name) SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM local_projects WHERE id=$1) ON CONFLICT (id) DO NOTHING', [`default:${userId}`, workspaceId, 'Výchozí projekt']);
    await client.query('INSERT INTO credit_accounts (id) VALUES ($1) ON CONFLICT DO NOTHING', [workspaceId]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  const ledger = new CreditLedger(pool);
  await ledger.grant(workspaceId, 'local-trial-v1', 10, 'PROMOTIONAL');
  const balance = await ledger.balance(workspaceId);
  const projects = await pool.query<{ id: string; name: string; archived_at: Date | null }>('SELECT id,name,archived_at FROM local_projects WHERE workspace_id=$1 ORDER BY created_at', [workspaceId]);
  const usage = await pool.query<{ mode: string; provider_status: string; credits: number; created_at: Date; project_name: string }>('SELECT u.mode,u.provider_status,u.credits,u.created_at,p.name AS project_name FROM local_usage_events u JOIN local_projects p ON p.id=u.project_id WHERE u.account_id=$1 ORDER BY u.created_at DESC LIMIT 50', [workspaceId]);
  const keys = await pool.query<{ id: string; name: string; key_prefix: string; expires_at: Date; revoked_at: Date | null; scopes: string[]; daily_request_limit: number; daily_used: number }>(`
    SELECT k.id, k.name, k.key_prefix, k.expires_at, k.revoked_at, k.scopes,
           k.daily_request_limit, COALESCE(r.requests, 0)::int AS daily_used
    FROM local_api_keys k
    LEFT JOIN shared_rate_limits r
      ON r.bucket = 'key-day:' || k.quota_id
     AND r.window_start = floor(extract(epoch FROM now()) / 86400)::bigint * 86400
    WHERE k.workspace_id = $1
    ORDER BY k.created_at DESC LIMIT 100`, [workspaceId]);
  return { workspaceId, defaultProjectId: `default:${userId}`, balance, projects: projects.rows, usage: usage.rows, keys: keys.rows };
}
