import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { CreditLedger } from '@/billing/credit-ledger';
import { isAllowedOrigin } from '@/server/security/origin';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  if (!auth || !pool) return Response.json({ error: 'Služba není dostupná.' }, { status: 503 });

  // For GET requests, browsers do not send an Origin header on same-origin fetch.
  // Enforce robust cross-site protection:
  // 1. If Origin header is present, it must be an allowed origin.
  // 2. If Sec-Fetch-Site is 'cross-site', reject immediately.
  // 3. If Referer is present, its origin must be an allowed origin.
  const origin = request.headers.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    return Response.json({ error: 'Neplatný původ požadavku.' }, { status: 403 });
  }

  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return Response.json({ error: 'Neplatný původ požadavku.' }, { status: 403 });
  }

  const referer = request.headers.get('referer');
  if (!origin && referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!isAllowedOrigin(refOrigin)) {
        return Response.json({ error: 'Neplatný odkazující původ.' }, { status: 403 });
      }
    } catch {
      return Response.json({ error: 'Neplatný odkazující původ.' }, { status: 403 });
    }
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.emailVerified) return Response.json({ error: 'Neautorizováno.' }, { status: 401 });

  const userId = session.user.id;
  try {
    const { workspaceId } = await personalWorkspace(userId);
    // Complete data retrieval: never arbitrarily truncate or silently omit historical records
    const [workspaceRes, projectsRes, keysRes, usageRes, usageEventsRes, transactionsRes, grantsRes] = await Promise.all([
      pool.query('SELECT id, name, created_at FROM local_workspaces WHERE id=$1 AND user_id=$2', [workspaceId, userId]),
      pool.query('SELECT id, name, created_at, archived_at FROM local_projects WHERE workspace_id=$1 ORDER BY created_at ASC', [workspaceId]),
      pool.query('SELECT id, name, key_prefix, scopes, daily_request_limit, created_at, expires_at, revoked_at FROM local_api_keys WHERE workspace_id=$1', [workspaceId]),
      pool.query('SELECT count(*)::int AS total_events, COALESCE(sum(credits), 0)::int AS total_credits FROM local_usage_events WHERE account_id=$1', [workspaceId]),
      pool.query('SELECT mode, provider_status, credits, created_at, project_id FROM local_usage_events WHERE account_id=$1 ORDER BY created_at DESC', [workspaceId]),
      pool.query('SELECT id, reservation_id, amount, created_at FROM credit_transactions WHERE account_id=$1 ORDER BY created_at DESC', [workspaceId]),
      pool.query('SELECT id, idempotency_key, category, amount, created_at FROM credit_grants WHERE account_id=$1 ORDER BY created_at DESC', [workspaceId]),
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
      creditGrants: grantsRes.rows,
      creditTransactions: transactionsRes.rows,
      usageSummary: usageRes.rows[0],
      usageEvents: usageEventsRes.rows,
      dataRetentionNotice: {
        scope: 'Complete export of user account, workspace configuration, API key metadata, and financial ledger events.',
        statutoryRetention: 'Financial ledger transactions and accounting records are retained in accordance with statutory accounting requirements, while personal identifying data is erased upon account deletion.',
      },
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="overto-account-export-${userId.slice(0, 8)}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('EXPORT_ERROR:', err);
    return Response.json({ error: 'Export účtu selhal.' }, { status: 500 });
  }
}
