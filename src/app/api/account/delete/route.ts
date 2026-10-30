import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { readRequestBody } from '@/lib/read-request-body';
import { isAllowedOrigin } from '@/server/security/origin';
import { verifyPassword } from 'better-auth/crypto';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  if (!auth || !pool) {
    return Response.json({ error: 'Služba není dostupná.' }, { status: 503 });
  }

  if (!isAllowedOrigin(request.headers.get('origin'))) {
    return Response.json({ error: 'Neplatný původ požadavku.' }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.emailVerified) {
    return Response.json({ error: 'Neautorizováno.' }, { status: 401 });
  }

  let body: { confirmEmail?: string; password?: string };
  try {
    const raw = await readRequestBody(request, 2048);
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return Response.json({ error: 'Neplatný požadavek.' }, { status: 400 });
  }

  if (!body.confirmEmail || body.confirmEmail.trim().toLowerCase() !== session.user.email.toLowerCase()) {
    return Response.json({ error: 'E-mail pro potvrzení smazání účtu nesouhlasí.' }, { status: 400 });
  }

  if (!body.password || typeof body.password !== 'string') {
    return Response.json({ error: 'Pro smazání účtu zadejte své heslo.' }, { status: 400 });
  }

  const userId = session.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Re-authenticate: verify password against Better Auth credential account
    const accountRes = await client.query<{ password: string }>(
      'SELECT password FROM "account" WHERE "userId" = $1 AND "providerId" = $2 FOR UPDATE',
      [userId, 'credential']
    );

    if (!accountRes.rowCount || !accountRes.rows[0].password) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Účet nemá nastaveno heslo.' }, { status: 400 });
    }

    const passwordMatches = await verifyPassword({
      hash: accountRes.rows[0].password,
      password: body.password,
    });

    if (!passwordMatches) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Zadané heslo pro potvrzení smazání účtu není správné.' }, { status: 403 });
    }

    // 2. Prevent sole ROOT platform admin from deleting own account
    const adminCheck = await client.query('SELECT role FROM platform_admins WHERE user_id=$1', [userId]);
    if (adminCheck.rowCount) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Hlavní administrátorský účet (ROOT) nelze smazat.' }, { status: 400 });
    }

    const { workspaceId } = await personalWorkspace(userId);

    // 3. Revoke & delete API keys and active sessions immediately
    await client.query('DELETE FROM local_api_keys WHERE workspace_id=$1', [workspaceId]);
    await client.query('DELETE FROM "session" WHERE "userId"=$1', [userId]);

    // 4. Delete user's personal projects and usage events
    await client.query('DELETE FROM local_usage_events WHERE account_id=$1', [workspaceId]);
    await client.query('DELETE FROM local_projects WHERE workspace_id=$1', [workspaceId]);

    // 5. Clean up Stripe workspace bindings (statutory webhook logs remain in local_stripe_events)
    await client.query('DELETE FROM local_stripe_checkout_attempts WHERE workspace_id=$1', [workspaceId]);
    await client.query('DELETE FROM local_stripe_subscriptions WHERE workspace_id=$1', [workspaceId]);
    await client.query('DELETE FROM local_stripe_customers WHERE workspace_id=$1', [workspaceId]);

    // 6. Delete credit ledger records in strict foreign key order
    await client.query('DELETE FROM credit_transactions WHERE account_id=$1', [workspaceId]);
    await client.query('DELETE FROM credit_reservations WHERE account_id=$1', [workspaceId]);
    await client.query('DELETE FROM credit_grants WHERE account_id=$1', [workspaceId]);
    await client.query('DELETE FROM credit_accounts WHERE id=$1', [workspaceId]);

    // 7. Delete workspace
    await client.query('DELETE FROM local_workspaces WHERE id=$1 AND user_id=$2', [workspaceId, userId]);

    // 8. Delete Better Auth user & credential account
    await client.query('DELETE FROM "account" WHERE "userId"=$1', [userId]);
    await client.query('DELETE FROM "user" WHERE id=$1', [userId]);

    await client.query('COMMIT');
    return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('DELETE_ERROR:', err);
    await client.query('ROLLBACK').catch(() => {});
    return Response.json({ error: 'Smazání účtu selhalo.' }, { status: 500 });
  } finally {
    client.release();
  }
}
