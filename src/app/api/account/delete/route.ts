import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { readRequestBody } from '@/lib/read-request-body';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  if (!auth || !pool || request.headers.get('origin') !== process.env.BETTER_AUTH_URL) {
    return Response.json({ error: 'Nedostupné.' }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.emailVerified) {
    return Response.json({ error: 'Neautorizováno.' }, { status: 401 });
  }

  let body: { confirmEmail?: string };
  try {
    const raw = await readRequestBody(request, 1024);
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return Response.json({ error: 'Neplatný požadavek.' }, { status: 400 });
  }

  if (body.confirmEmail?.trim().toLowerCase() !== session.user.email.toLowerCase()) {
    return Response.json({ error: 'E-mail pro potvrzení smazání účtu nesouhlasí.' }, { status: 400 });
  }

  const userId = session.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user is the sole ROOT platform admin
    const adminCheck = await client.query('SELECT role FROM platform_admins WHERE user_id=$1', [userId]);
    if (adminCheck.rowCount) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Hlavní administrátorský účet (ROOT) nelze smazat.' }, { status: 400 });
    }

    const { workspaceId } = await personalWorkspace(userId);

    // Delete workspace-associated resources in tenant boundary
    await client.query('DELETE FROM local_usage_events WHERE account_id=$1', [workspaceId]);
    await client.query('DELETE FROM local_api_keys WHERE workspace_id=$1', [workspaceId]);
    await client.query('DELETE FROM local_projects WHERE workspace_id=$1', [workspaceId]);
    await client.query('DELETE FROM local_stripe_subscriptions WHERE workspace_id=$1', [workspaceId]);
    await client.query('DELETE FROM local_stripe_customers WHERE workspace_id=$1', [workspaceId]);
    await client.query('DELETE FROM credit_transactions WHERE account_id=$1', [workspaceId]);
    await client.query('DELETE FROM credit_reservations WHERE account_id=$1', [workspaceId]);
    await client.query('DELETE FROM credit_grants WHERE account_id=$1', [workspaceId]);
    await client.query('DELETE FROM credit_accounts WHERE id=$1', [workspaceId]);
    await client.query('DELETE FROM local_workspaces WHERE id=$1 AND user_id=$2', [workspaceId, userId]);

    // Delete Better Auth sessions and accounts
    await client.query('DELETE FROM "session" WHERE "userId"=$1', [userId]);
    await client.query('DELETE FROM "account" WHERE "userId"=$1', [userId]);
    await client.query('DELETE FROM "user" WHERE id=$1', [userId]);

    await client.query('COMMIT');
    return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    await client.query('ROLLBACK');
    return Response.json({ error: 'Smazání účtu selhalo.' }, { status: 500 });
  } finally {
    client.release();
  }
}
