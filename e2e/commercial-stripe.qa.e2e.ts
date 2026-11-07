import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import Stripe from 'stripe';

const origin = 'http://127.0.0.1:3016';
const inbox = 'http://127.0.0.1:8025';

function qaEnv() {
  return Object.fromEntries(readFileSync('.env.ai-qa', 'utf8').split(/\r?\n/)
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).trim()]; }));
}

async function verificationLink(email: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const messages = await (await fetch(`${inbox}/api/v1/messages?limit=100`)).json();
    const match = messages.messages.find((item: { To: { Address: string }[]; Subject: string }) =>
      item.Subject === 'Ověření e-mailu — OvěřTo.AI' && item.To.some(to => to.Address === email));
    if (match) {
      const message = await (await fetch(`${inbox}/api/v1/message/${match.ID}`)).json();
      const link = String(message.Text).match(/https?:\/\/[^\s]+/g)?.find(candidate => candidate.startsWith(`${origin}/`));
      if (link) return link;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Sandbox verification email not received');
}

test('Stripe Sandbox checkout, paid invoice, refund, cancellation and account deletion', async ({ page }) => {
  test.skip(process.env.OVERTO_STRIPE_QA_E2E !== 'true', 'Dedicated Stripe Sandbox QA only');
  test.setTimeout(120000);
  const env = qaEnv();
  if (env.OVERTO_BILLING_MODE !== 'test' || env.OVERTO_BILLING_CHECKOUT_ENABLED !== 'true' ||
      !/^sk_test_[A-Za-z0-9_]+$/.test(env.STRIPE_TEST_SECRET_KEY ?? '') ||
      !/^whsec_[A-Za-z0-9_]+$/.test(env.STRIPE_TEST_WEBHOOK_SECRET ?? '') ||
      !env.OVERTO_DATABASE_URL?.includes('@postgres:5432/overto')) throw new Error('Dedicated Stripe Sandbox QA configuration required');
  const url = new URL(env.OVERTO_DATABASE_URL);
  url.hostname = '127.0.0.1'; url.port = '55447';
  const pool = new Pool({ connectionString: url.toString() });
  const stripe = new Stripe(env.STRIPE_TEST_SECRET_KEY, { timeout: 10000, maxNetworkRetries: 0 });
  const email = `billing-qa-${randomUUID()}@example.com`;
  const password = `synthetic-${randomUUID()}`;
  let checkoutId: string | undefined;
  let subscriptionId: string | undefined;
  try {
    const plansResponse = await page.request.get(`${origin}/api/billing/plans`);
    expect(plansResponse.status()).toBe(200);
    const plans = await plansResponse.json();
    expect(plans.mode).toBe('test');
    const plan = plans.plans.find((item: { code: string }) => item.code === 'qa-stripe-monthly');
    expect(plan?.paymentConfigurationPresent).toBe(true);

    const signup = await page.request.post(`${origin}/api/auth/sign-up/email`, {
      headers: { Origin: origin }, data: { name: 'Billing QA', email, password },
    });
    expect(signup.status(), await signup.text()).toBe(200);
    await page.goto(await verificationLink(email));
    const login = await page.request.post(`${origin}/api/auth/sign-in/email`, {
      headers: { Origin: origin }, data: { email, password },
    });
    expect(login.status(), await login.text()).toBe(200);

    const checkoutResponse = await page.request.post(`${origin}/api/billing/checkout`, {
      headers: { Origin: origin, 'Idempotency-Key': randomUUID() }, data: { planVersionId: plan.id },
    });
    expect(checkoutResponse.status(), await checkoutResponse.text()).toBe(200);
    const order = await checkoutResponse.json();
    expect(order.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const stored = await pool.query('SELECT status,stripe_checkout_session_id,stripe_customer_id,workspace_id,plan_version_id FROM billing_orders WHERE id=$1 AND mode=$2', [order.orderId, 'test']);
    expect(stored.rows[0].status).toBe('PENDING');
    checkoutId = stored.rows[0].stripe_checkout_session_id;
    const session = await stripe.checkout.sessions.retrieve(checkoutId!);
    expect(session.livemode).toBe(false);
    expect(session.status).toBe('open');
    expect(session.client_reference_id).toBe(order.orderId);

    const payload = JSON.stringify({ id: `evt_qa_${randomUUID().replaceAll('-', '')}`, type: 'checkout.session.expired', livemode: false, data: { object: { id: checkoutId } } });
    const invalid = await page.request.post(`${origin}/api/billing/webhook`, { headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 'invalid' }, data: payload });
    expect(invalid.status()).toBe(400);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_TEST_WEBHOOK_SECRET });
    const signed = await page.request.post(`${origin}/api/billing/webhook`, { headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature }, data: payload });
    expect(signed.status(), await signed.text()).toBe(200);

    // A real sandbox card charge exercises Stripe's invoice and refund objects.
    // It does not submit Checkout's hosted form or charge a live card.
    const customerId = stored.rows[0].stripe_customer_id;
    const paymentMethod = await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId });
    await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethod.id } });
    const subscription = await stripe.subscriptions.create({
      customer: customerId, items: [{ price: env.STRIPE_TEST_PRICE_ID }], payment_behavior: 'error_if_incomplete',
      metadata: { orderId: order.orderId, workspaceId: stored.rows[0].workspace_id,
        planVersionId: stored.rows[0].plan_version_id, billingMode: 'test' },
    });
    subscriptionId = subscription.id;
    expect(subscription.livemode).toBe(false);
    const invoiceId = typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : subscription.latest_invoice?.id;
    expect(invoiceId).toBeTruthy();
    const invoice = await stripe.invoices.retrieve(invoiceId!);
    expect(invoice.status).toBe('paid');
    const paidPayload = JSON.stringify({ id: `evt_qa_paid_${randomUUID().replaceAll('-', '')}`, type: 'invoice.paid', livemode: false, data: { object: { id: invoice.id } } });
    const paidSignature = stripe.webhooks.generateTestHeaderString({ payload: paidPayload, secret: env.STRIPE_TEST_WEBHOOK_SECRET });
    const paidWebhook = await page.request.post(`${origin}/api/billing/webhook`, { headers: { 'Content-Type': 'application/json', 'Stripe-Signature': paidSignature }, data: paidPayload });
    expect(paidWebhook.status(), await paidWebhook.text()).toBe(200);
    const grantKey = `stripe-test-invoice:${invoice.id}`;
    const grants = await pool.query('SELECT amount FROM credit_grants WHERE account_id=$1 AND idempotency_key=$2', [stored.rows[0].workspace_id, grantKey]);
    expect(grants.rows[0]?.amount).toBe(100);

    const payments = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 10 });
    const intentId = payments.data.find(item => item.payment.type === 'payment_intent')?.payment.payment_intent;
    expect(intentId).toBeTruthy();
    const intent = await stripe.paymentIntents.retrieve(typeof intentId === 'string' ? intentId : intentId!.id);
    const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
    expect(chargeId).toBeTruthy();
    await stripe.refunds.create({ charge: chargeId! });
    const refundPayload = JSON.stringify({ id: `evt_qa_refund_${randomUUID().replaceAll('-', '')}`, type: 'charge.refunded', livemode: false, data: { object: { id: chargeId } } });
    const refundSignature = stripe.webhooks.generateTestHeaderString({ payload: refundPayload, secret: env.STRIPE_TEST_WEBHOOK_SECRET });
    const refundWebhook = await page.request.post(`${origin}/api/billing/webhook`, { headers: { 'Content-Type': 'application/json', 'Stripe-Signature': refundSignature }, data: refundPayload });
    expect(refundWebhook.status(), await refundWebhook.text()).toBe(200);
    const reversed = await pool.query('SELECT COALESCE(SUM(amount),0)::int AS amount FROM credit_reversals WHERE account_id=$1', [stored.rows[0].workspace_id]);
    expect(reversed.rows[0].amount).toBe(100);

    await stripe.subscriptions.cancel(subscriptionId);
    const cancelPayload = JSON.stringify({ id: `evt_qa_cancel_${randomUUID().replaceAll('-', '')}`, type: 'customer.subscription.deleted', livemode: false, data: { object: { id: subscriptionId } } });
    const cancelSignature = stripe.webhooks.generateTestHeaderString({ payload: cancelPayload, secret: env.STRIPE_TEST_WEBHOOK_SECRET });
    const cancelWebhook = await page.request.post(`${origin}/api/billing/webhook`, { headers: { 'Content-Type': 'application/json', 'Stripe-Signature': cancelSignature }, data: cancelPayload });
    expect(cancelWebhook.status(), await cancelWebhook.text()).toBe(200);

    const expired = await stripe.checkout.sessions.expire(checkoutId!);
    expect(expired.status).toBe('expired');
    await pool.query("UPDATE billing_orders SET expires_at=now()-interval '1 minute' WHERE id=$1", [order.orderId]);
    const deletion = await page.request.post(`${origin}/api/account/delete`, {
      headers: { Origin: origin }, data: { confirmEmail: email, password },
    });
    expect(deletion.status(), await deletion.text()).toBe(200);
    expect((await pool.query('SELECT status FROM billing_orders WHERE id=$1', [order.orderId])).rows[0].status).toBe('PAID');
    expect((await pool.query('SELECT 1 FROM "user" WHERE email=$1', [email])).rowCount).toBe(0);
  } finally {
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId).catch(() => null);
      if (subscription && subscription.status !== 'canceled') await stripe.subscriptions.cancel(subscriptionId).catch(() => {});
    }
    if (checkoutId) {
      const session = await stripe.checkout.sessions.retrieve(checkoutId).catch(() => null);
      if (session?.status === 'open') await stripe.checkout.sessions.expire(checkoutId).catch(() => {});
    }
    await pool.end();
  }
});
