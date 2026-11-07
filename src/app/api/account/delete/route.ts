import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { readRequestBody } from '@/lib/read-request-body';
import { isAllowedOrigin } from '@/server/security/origin';
import { billingReconciliationStripe } from '@/billing/config';
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
    // Serialize with both Test and Live checkout/webhook transactions. A
    // checkout started after deletion must fail its workspace existence check.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`billing:test:${workspaceId}`]);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`billing:live:${workspaceId}`]);

    // Financial history is retained, but a Stripe subscription must be canceled
    // through the billing portal before its local customer mapping can be erased.
    const commercialBilling = await client.query("SELECT 1 FROM billing_subscriptions WHERE workspace_id=$1 AND status IN ('active','trialing','past_due','unpaid','incomplete') LIMIT 1", [workspaceId]);
    if (commercialBilling.rowCount) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Nejprve ukončete aktivní předplatné v platebním portálu.' }, { status: 409 });
    }
    const expiredLinked = await client.query<{ id: string; mode: 'test' | 'live'; stripe_checkout_session_id: string; stripe_customer_id: string; plan_version_id: string; currency: string; amount_minor: string }>(
      `SELECT id,mode,stripe_checkout_session_id,stripe_customer_id,plan_version_id,currency,amount_minor
       FROM billing_orders WHERE workspace_id=$1 AND status='PENDING' AND expires_at<=now()
         AND stripe_checkout_session_id IS NOT NULL ORDER BY created_at LIMIT 10 FOR UPDATE`, [workspaceId]);
    for (const order of expiredLinked.rows) {
      const stripe = billingReconciliationStripe(order.mode);
      if (!stripe) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'Platbu nyní nelze ověřit. Kontaktujte správce.' }, { status: 503 });
      }
      try {
        let checkout = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
        const matches = () => checkout.livemode === (order.mode === 'live') && checkout.id === order.stripe_checkout_session_id &&
          checkout.client_reference_id === order.id && checkout.metadata?.orderId === order.id &&
          checkout.metadata?.workspaceId === workspaceId && checkout.metadata?.planVersionId === order.plan_version_id &&
          checkout.metadata?.billingMode === order.mode && checkout.customer === order.stripe_customer_id &&
          checkout.currency?.toUpperCase() === order.currency && checkout.amount_subtotal === Number(order.amount_minor);
        if (!matches()) throw new Error('CHECKOUT_RECONCILIATION_MISMATCH');
        if (checkout.status === 'open') checkout = await stripe.checkout.sessions.expire(order.stripe_checkout_session_id);
        if (!matches() || checkout.status !== 'expired' || checkout.payment_status !== 'unpaid') {
          await client.query('ROLLBACK');
          return Response.json({ error: 'Platba ještě není bezpečně uzavřená.' }, { status: 409 });
        }
        await client.query("UPDATE billing_orders SET status='EXPIRED',updated_at=now() WHERE id=$1 AND status='PENDING'", [order.id]);
      } catch (error) {
        console.error('CHECKOUT_RECONCILIATION_ERROR:', error);
        await client.query('ROLLBACK');
        return Response.json({ error: 'Platbu nyní nelze ověřit. Zkuste to později.' }, { status: 503 });
      }
    }
    const pendingPayment = await client.query("SELECT 1 FROM billing_orders WHERE workspace_id=$1 AND (status='PROCESSING' OR (status='PENDING' AND (expires_at>now() OR stripe_checkout_session_id IS NOT NULL))) LIMIT 1", [workspaceId]);
    if (pendingPayment.rowCount) {
      // Keep any successfully reconciled batch so repeated attempts progress.
      await client.query('COMMIT');
      return Response.json({ error: 'Nejprve dokončete nebo nechte vypršet rozpracovanou platbu.' }, { status: 409 });
    }

    // 3. Revoke & delete API keys and active sessions immediately
    await client.query('DELETE FROM local_api_keys WHERE workspace_id=$1', [workspaceId]);
    await client.query('DELETE FROM "session" WHERE "userId"=$1', [userId]);

    // 4. Delete user's personal projects and usage events
    await client.query('DELETE FROM local_usage_events WHERE account_id=$1', [workspaceId]);
    await client.query('DELETE FROM local_projects WHERE workspace_id=$1', [workspaceId]);

    // 5. Keep commercial Stripe customer mapping and financial history so later
    // refunds can be reconciled after account deletion. Personal workspace data
    // below is erased; only the opaque transaction reference remains.
    await client.query('DELETE FROM local_stripe_checkout_attempts WHERE workspace_id=$1', [workspaceId]);
    await client.query('DELETE FROM local_stripe_subscriptions WHERE workspace_id=$1', [workspaceId]);
    await client.query('DELETE FROM local_stripe_customers WHERE workspace_id=$1', [workspaceId]);

    // 6. Delete credit ledger records in strict foreign key order
    await client.query('DELETE FROM credit_transactions WHERE account_id=$1', [workspaceId]);
    await client.query('DELETE FROM credit_reservations WHERE account_id=$1', [workspaceId]);
    await client.query('DELETE FROM credit_reversals WHERE account_id=$1', [workspaceId]);
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
