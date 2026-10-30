import 'server-only';
import type { Pool } from 'pg';

export type UserRow = {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  createdAt: Date;
  workspaceId: string | null;
  projects: number;
  granted: number;
  consumed: number;
};

export class AdminOperations {
  constructor(private readonly pool: Pool) {}

  async overview() {
    const [users, workspaces, projects, requests, subscriptions] = await Promise.all([
      this.pool.query('SELECT count(*)::int AS value FROM "user"'),
      this.pool.query('SELECT count(*)::int AS value FROM local_workspaces'),
      this.pool.query('SELECT count(*)::int AS value FROM local_projects WHERE archived_at IS NULL'),
      this.pool.query("SELECT count(*)::int AS value FROM local_usage_events WHERE created_at >= date_trunc('day', now())"),
      this.pool.query('SELECT count(*)::int AS value FROM local_stripe_subscriptions'),
    ]);
    return {
      users: users.rows[0].value as number,
      workspaces: workspaces.rows[0].value as number,
      projects: projects.rows[0].value as number,
      requestsToday: requests.rows[0].value as number,
      testSubscriptions: subscriptions.rows[0].value as number,
    };
  }

  async users(query: string, page: number): Promise<{ rows: UserRow[]; hasMore: boolean; query: string; page: number }> {
    const q = query.trim().slice(0, 80);
    const safePage = Number.isSafeInteger(page) ? Math.max(1, Math.min(100, page)) : 1;
    const escaped = q.replace(/[\\%_]/g, '\\$&');
    const result = await this.pool.query<{
      id: string; name: string; email: string; verified: boolean; created_at: Date;
      workspace_id: string | null; projects: number; granted: number; consumed: number;
    }>(`SELECT u.id,u.name,u.email,u."emailVerified" AS verified,u."createdAt" AS created_at,
        w.id AS workspace_id,
        COALESCE((SELECT count(*)::int FROM local_projects p WHERE p.workspace_id=w.id AND p.archived_at IS NULL),0) AS projects,
        COALESCE((SELECT sum(g.amount)::int FROM credit_grants g WHERE g.account_id=w.id),0) AS granted,
        COALESCE((SELECT sum(t.amount)::int FROM credit_transactions t WHERE t.account_id=w.id),0) AS consumed
      FROM "user" u LEFT JOIN local_workspaces w ON w.user_id=u.id
      WHERE ($1='' OR u.email ILIKE $2 ESCAPE '\\' OR u.name ILIKE $2 ESCAPE '\\')
      ORDER BY u."createdAt" DESC,u.id DESC LIMIT 51 OFFSET $3`, [q, `${escaped}%`, (safePage - 1) * 50]);
    return { rows: result.rows.slice(0, 50).map(row => ({
      id: row.id, name: row.name, email: row.email, verified: row.verified,
      createdAt: row.created_at, workspaceId: row.workspace_id,
      projects: row.projects, granted: row.granted, consumed: row.consumed,
    })), hasMore: result.rows.length > 50, query: q, page: safePage };
  }

  async billing() {
    const [subscriptions, events] = await Promise.all([
      this.pool.query<{ email: string; status: string; cancel_at_period_end: boolean; refreshed_at: Date }>(
        `SELECT u.email,s.status,s.cancel_at_period_end,s.refreshed_at
         FROM local_stripe_subscriptions s JOIN local_workspaces w ON w.id=s.workspace_id
         JOIN "user" u ON u.id=w.user_id ORDER BY s.refreshed_at DESC LIMIT 50`),
      this.pool.query<{ event_type: string; processed_at: Date }>(
        'SELECT event_type,processed_at FROM local_stripe_events ORDER BY processed_at DESC LIMIT 50'),
    ]);
    return { subscriptions: subscriptions.rows, events: events.rows };
  }

  async audit() {
    const result = await this.pool.query<{
      actor: string; source: string; action: string; target: string | null; created_at: Date;
    }>(`SELECT u.email AS actor,'SITE' AS source,'SETTINGS_UPDATED' AS action,
        s.version::text AS target,s.created_at
      FROM platform_settings_audit s JOIN "user" u ON u.id=s.actor_id
      UNION ALL
      SELECT u.email AS actor,'AI_STUDIO' AS source,a.action,a.target_id AS target,a.created_at
      FROM ai_operations_audit a JOIN "user" u ON u.id=a.actor_id
      ORDER BY created_at DESC LIMIT 100`);
    return result.rows;
  }

  async system() {
    const result = await this.pool.query<{ database_time: Date; auth_schema: string | null; ledger_schema: string | null }>(
      "SELECT now() AS database_time,to_regclass('public.user')::text AS auth_schema,to_regclass('public.credit_accounts')::text AS ledger_schema");
    return result.rows[0];
  }
}
