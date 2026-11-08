import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { readRequestBody } from '@/lib/read-request-body';
import { isAllowedOrigin } from '@/server/security/origin';
import { billingReconciliationStripe } from '@/billing/config';
import { verifyPassword } from 'better-auth/crypto';
import type { NextRequest } from 'next/server';

type ExpiredOrder = { id: string; mode: 'test' | 'live'; stripe_checkout_session_id: string; stripe_customer_id: string; plan_version_id: string; currency: string; amount_minor: string };
const expiredOrderQuery = `SELECT id,mode,stripe_checkout_session_id,stripe_customer_id,plan_version_id,currency,amount_minor
  FROM billing_orders WHERE workspace_id=$1 AND status='PENDING' AND expires_at<=now()
    AND stripe_checkout_session_id IS NOT NULL ORDER BY created_at LIMIT 3`;

function sameOrder(a: ExpiredOrder, b: ExpiredOrder) {
  return a.id === b.id && a.mode === b.mode && a.stripe_checkout_session_id === b.stripe_checkout_session_id &&
    a.stripe_customer_id === b.stripe_customer_id && a.plan_version_id === b.plan_version_id &&
    a.currency === b.currency && a.amount_minor === b.amount_minor;
}

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
  let workspaceId: string;
  let passwordHash: string;
  const verified = new Map<string, ExpiredOrder>();
  try {
  // Password hashing and Stripe network calls run before any database transaction.
  const credential = await pool.query<{ password: string }>(
    'SELECT password FROM "account" WHERE "userId"=$1 AND "providerId"=$2', [userId, 'credential']);
  passwordHash = credential.rows[0]?.password;
  if (!passwordHash) return Response.json({ error: 'Účet nemá nastaveno heslo.' }, { status: 400 });
  if (!await verifyPassword({ hash: passwordHash, password: body.password }))
    return Response.json({ error: 'Zadané heslo pro potvrzení smazání účtu není správné.' }, { status: 403 });
  const root = await pool.query('SELECT 1 FROM platform_admins WHERE user_id=$1', [userId]);
  if (root.rowCount) return Response.json({ error: 'Hlavní administrátorský účet (ROOT) nelze smazat.' }, { status: 400 });
  ({ workspaceId } = await personalWorkspace(userId));
  const expired = await pool.query<ExpiredOrder>(expiredOrderQuery, [workspaceId]);
  for (const order of expired.rows) {
    const stripe = billingReconciliationStripe(order.mode);
    if (!stripe) return Response.json({ error: 'Platbu nyní nelze ověřit. Kontaktujte správce.' }, { status: 503 });
    try {
      let checkout = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
      const matches = () => checkout.livemode === (order.mode === 'live') && checkout.id === order.stripe_checkout_session_id &&
        checkout.client_reference_id === order.id && checkout.metadata?.orderId === order.id &&
        checkout.metadata?.workspaceId === workspaceId && checkout.metadata?.planVersionId === order.plan_version_id &&
        checkout.metadata?.billingMode === order.mode && checkout.customer === order.stripe_customer_id &&
        checkout.currency?.toUpperCase() === order.currency && checkout.amount_subtotal === Number(order.amount_minor);
      if (!matches()) throw new Error('CHECKOUT_RECONCILIATION_MISMATCH');
      if (checkout.status === 'open') checkout = await stripe.checkout.sessions.expire(order.stripe_checkout_session_id);
      if (!matches() || checkout.status !== 'expired' || checkout.payment_status !== 'unpaid')
        return Response.json({ error: 'Platba ještě není bezpečně uzavřená.' }, { status: 409 });
      verified.set(order.id, order);
    } catch (error) {
      console.error('CHECKOUT_RECONCILIATION_ERROR:', error);
      return Response.json({ error: 'Platbu nyní nelze ověřit. Zkuste to později.' }, { status: 503 });
    }
  }
  } catch (error) {
    console.error('DELETE_ERROR:', error);
    return Response.json({ error: 'Smazání účtu selhalo.' }, { status: 500 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lockedAccount = await client.query<{ password: string }>(
      'SELECT password FROM "account" WHERE "userId"=$1 AND "providerId"=$2 FOR UPDATE', [userId, 'credential']);
    if (lockedAccount.rows[0]?.password !== passwordHash) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Přihlášení se mezitím změnilo. Zkuste to znovu.' }, { status: 409 });
    }
    const adminCheck = await client.query('SELECT role FROM platform_admins WHERE user_id=$1', [userId]);
    if (adminCheck.rowCount) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Hlavní administrátorský účet (ROOT) nelze smazat.' }, { status: 400 });
    }
    // Checkout and webhooks use the same workspace locks. Re-read all payment
    // state after acquiring them; no external I/O occurs while locks are held.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`billing:test:${workspaceId}`]);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`billing:live:${workspaceId}`]);
    const commercialBilling = await client.query("SELECT 1 FROM billing_subscriptions WHERE workspace_id=$1 AND status IN ('active','trialing','past_due','unpaid','incomplete') LIMIT 1", [workspaceId]);
    if (commercialBilling.rowCount) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Nejprve ukončete aktivní předplatné v platebním portálu.' }, { status: 409 });
    }
    const currentExpired = await client.query<ExpiredOrder>(`${expiredOrderQuery} FOR UPDATE`, [workspaceId]);
    for (const order of currentExpired.rows) {
      const prior = verified.get(order.id);
      if (!prior || !sameOrder(order, prior)) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'Stav platby se změnil. Zkuste to znovu.' }, { status: 409 });
      }
      await client.query("UPDATE billing_orders SET status='EXPIRED',updated_at=now() WHERE id=$1 AND status='PENDING'", [order.id]);
    }
    const pendingPayment = await client.query("SELECT 1 FROM billing_orders WHERE workspace_id=$1 AND (status='PROCESSING' OR (status='PENDING' AND (expires_at>now() OR stripe_checkout_session_id IS NOT NULL))) LIMIT 1", [workspaceId]);
    if (pendingPayment.rowCount) {
      // Commit a verified batch so large histories can progress on retry.
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
