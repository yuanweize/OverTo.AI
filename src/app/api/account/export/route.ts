import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { CreditLedger } from '@/billing/credit-ledger';
import { isAllowedOrigin } from '@/server/security/origin';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  if (!auth || !pool) return Response.json({ error: 'Služba není dostupná.' }, { status: 503 });

  if (!isAllowedOrigin(request.headers.get('origin'))) {
    return Response.json({ error: 'Neplatný původ požadavku.' }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.emailVerified) return Response.json({ error: 'Neautorizováno.' }, { status: 401 });

  const userId = session.user.id;
  try {
    const { workspaceId } = await personalWorkspace(userId);
    const [workspaceRes, projectsRes, keysRes, usageRes, recentUsageRes, transactionsRes, grantsRes] = await Promise.all([
      pool.query('SELECT id, name, created_at FROM local_workspaces WHERE id=$1 AND user_id=$2', [workspaceId, userId]),
      pool.query('SELECT id, name, created_at, archived_at FROM local_projects WHERE workspace_id=$1 ORDER BY created_at ASC', [workspaceId]),
      pool.query('SELECT id, name, key_prefix, scopes, daily_request_limit, created_at, expires_at, revoked_at FROM local_api_keys WHERE workspace_id=$1', [workspaceId]),
      pool.query('SELECT count(*)::int AS total_events, COALESCE(sum(credits), 0)::int AS total_credits FROM local_usage_events WHERE account_id=$1', [workspaceId]),
      pool.query('SELECT mode, provider_status, credits, created_at, project_id FROM local_usage_events WHERE account_id=$1 ORDER BY created_at DESC LIMIT 500', [workspaceId]),
      pool.query('SELECT id, reservation_id, amount, created_at FROM credit_transactions WHERE account_id=$1 ORDER BY created_at DESC LIMIT 500', [workspaceId]),
      pool.query('SELECT id, idempotency_key, category, amount, created_at FROM credit_grants WHERE account_id=$1 ORDER BY created_at DESC LIMIT 500', [workspaceId]),
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
      recentUsageEvents: recentUsageRes.rows,
      legalAndGdprNotice: {
        regulation: 'Regulation (EU) 2016/679 (GDPR) Article 15 (Right of access) & Article 17 (Right to erasure)',
        statutoryRetention: 'Under Article 17(3)(b) of GDPR and the Czech Accounting Act (Act No. 563/1991 Coll.), commercial transactions and financial ledger audit records must be retained for statutory tax/accounting periods (up to 10 years) upon account termination, while personal identifying data is erased.',
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
