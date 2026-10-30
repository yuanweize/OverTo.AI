import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { CreditLedger } from '@/billing/credit-ledger';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  if (!auth || !pool) return Response.json({ error: 'Služba není dostupná.' }, { status: 503 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.emailVerified) return Response.json({ error: 'Neautorizováno.' }, { status: 401 });

  const userId = session.user.id;
  try {
    const { workspaceId } = await personalWorkspace(userId);
    const [workspaceRes, projectsRes, keysRes, usageRes] = await Promise.all([
      pool.query('SELECT id, name, created_at FROM local_workspaces WHERE id=$1 AND user_id=$2', [workspaceId, userId]),
      pool.query('SELECT id, name, created_at, archived_at FROM local_projects WHERE workspace_id=$1 ORDER BY created_at ASC', [workspaceId]),
      pool.query('SELECT id, name, key_prefix, scopes, daily_request_limit, created_at, expires_at, revoked_at FROM local_api_keys WHERE workspace_id=$1', [workspaceId]),
      pool.query('SELECT count(*)::int AS total_events, COALESCE(sum(credits), 0)::int AS total_credits FROM local_usage_events WHERE account_id=$1', [workspaceId]),
    ]);

    const balance = await new CreditLedger(pool).balance(workspaceId);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        createdAt: session.user.createdAt,
      },
      workspace: workspaceRes.rows[0] || null,
      projects: projectsRes.rows,
      apiKeys: keysRes.rows,
      credits: balance,
      usageSummary: usageRes.rows[0],
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="overto-account-export-${userId.slice(0, 8)}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json({ error: 'Export účtu selhal.' }, { status: 500 });
  }
}
