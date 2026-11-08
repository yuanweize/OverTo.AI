// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type Stripe from 'stripe';
import { BillingCheckout } from '@/billing/checkout';
import { BillingEvents } from '@/billing/events';

const connectionString = process.env.SITE_CONFIG_TEST_DATABASE_URL;
describe.skipIf(!connectionString)('commercial checkout on isolated PostgreSQL', () => {
  const schema = `billing_checkout_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString });
  let pool: Pool;
  let planId: string;
  let monthlyPlanId: string;
  const workspaceId = `checkout-${randomUUID()}`;
  const stripe = {
    prices: { retrieve: vi.fn(async () => ({ livemode: false, active: true, currency: 'czk', unit_amount: 9900, product: 'prod_synthetic', type: 'one_time' })) },
    customers: {
      create: vi.fn(async () => ({ id: 'cus_synthetic', livemode: false })),
      retrieve: vi.fn(async () => ({ id: 'cus_synthetic', livemode: false, deleted: false, metadata: { workspaceId } })),
    },
    subscriptions: {
      list: vi.fn(async () => ({ data: [], has_more: false })),
      retrieve: vi.fn(async (subscriptionId: string) => ({ id: subscriptionId, livemode: false, customer: 'cus_synthetic', metadata: {}, status: 'active', cancel_at_period_end: false, items: { data: [] } })),
    },
    invoices: { retrieve: vi.fn(async () => ({ id: 'in_synthetic', livemode: false, customer: 'cus_synthetic' })) },
    invoicePayments: { list: vi.fn(async () => ({ data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_synthetic' } }], has_more: false })) },
    paymentIntents: { retrieve: vi.fn(async () => ({ id: 'pi_synthetic', livemode: false, status: 'succeeded', amount_received: 9900, currency: 'czk', customer: 'cus_synthetic' })) },
    charges: { retrieve: vi.fn(async () => ({ id: 'ch_synthetic', livemode: false, amount: 9900, amount_refunded: 4950, payment_intent: 'pi_synthetic', customer: 'cus_synthetic' })) },
    checkout: { sessions: {
      create: vi.fn(async () => ({ id: `cs_test_${randomUUID().replaceAll('-', '')}`, livemode: false, url: 'https://checkout.stripe.com/c/test', status: 'open' })),
      retrieve: vi.fn(async () => ({ id: 'cs_test_synthetic', livemode: false, url: 'https://checkout.stripe.com/c/test', status: 'open' })),
    } },
  };
  beforeAll(async () => {
    const url = new URL(connectionString!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/overto_test') throw new Error('Requires disposable local overto_test');
    await control.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
    await pool.query('CREATE TABLE "user"(id text PRIMARY KEY)');
    await pool.query(await readFile('migrations/001_credit_ledger.sql', 'utf8'));
    await pool.query(await readFile('migrations/020_credit_reversals.sql', 'utf8'));
    await pool.query(await readFile('migrations/002_local_workspace.sql', 'utf8'));
    await pool.query(await readFile('migrations/021_billing_catalog.sql', 'utf8'));
    await pool.query(await readFile('migrations/022_billing_commerce.sql', 'utf8'));
    await pool.query('INSERT INTO "user"(id) VALUES($1)', ['owner']);
    await pool.query('INSERT INTO local_workspaces(id,user_id,name) VALUES($1,$2,$3)', [workspaceId, 'owner', 'Test']);
    await pool.query('INSERT INTO credit_accounts(id) VALUES($1)', [workspaceId]);
    const result = await pool.query<{ id: string }>(`INSERT INTO billing_plan_versions
      (code,version,kind,name_cs,name_en,description_cs,description_en,currency,amount_minor,pack_credits,is_visible,is_purchasable,stripe_test_product_id,stripe_test_price_id)
      VALUES ('test-pack',1,'CREDIT_PACK','Balík','Pack','','','CZK',9900,100,true,true,'prod_synthetic','price_synthetic') RETURNING id`);
    planId = result.rows[0].id;
    monthlyPlanId = (await pool.query<{ id: string }>(`INSERT INTO billing_plan_versions
      (code,version,kind,name_cs,name_en,description_cs,description_en,currency,amount_minor,monthly_credits,is_visible,is_purchasable,stripe_test_product_id,stripe_test_price_id)
      VALUES ('test-monthly',1,'MONTHLY','Měsíčně','Monthly','','','CZK',9900,100,true,true,'prod_synthetic','price_monthly') RETURNING id`)).rows[0].id;
  });
  afterAll(async () => {
    if (pool) await pool.end();
    await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await control.end();
  });

  it('reserves one durable order and reuses it for identical retries', async () => {
    const checkout = new BillingCheckout(pool, stripe as unknown as Stripe, 'test', 'http://127.0.0.1:3005', false);
    const requestId = randomUUID();
    const first = await checkout.create(workspaceId, planId, requestId);
    const replay = await checkout.create(workspaceId, planId, requestId);
    expect(replay).toEqual(first);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    const order = await pool.query('SELECT * FROM billing_orders WHERE id=$1', [first.orderId]);
    expect(order.rows[0]).toMatchObject({ mode: 'test', workspace_id: workspaceId, credits: 100, status: 'PENDING' });
    expect(order.rows[0].stripe_checkout_session_id).toMatch(/^cs_test_/);
    await expect(checkout.create(workspaceId, randomUUID(), requestId)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  });

  it('fails closed on a mismatched Stripe price before issuing checkout', async () => {
    stripe.prices.retrieve.mockResolvedValueOnce({ livemode: false, active: true, currency: 'czk', unit_amount: 1, product: 'prod_synthetic', type: 'one_time' });
    const checkout = new BillingCheckout(pool, stripe as unknown as Stripe, 'test', 'http://127.0.0.1:3005', false);
    await expect(checkout.create(workspaceId, planId, randomUUID())).rejects.toThrow('PRICE_MISMATCH');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    await expect(checkout.create('personal:deleted-user', planId, randomUUID())).rejects.toThrow('WORKSPACE_NOT_FOUND');
  });

  it('grants only after a paid event, tolerates replay, and reverses partial then full refunds', async () => {
    const checkout = new BillingCheckout(pool, stripe as unknown as Stripe, 'test', 'http://127.0.0.1:3005', false);
    const created = await checkout.create(workspaceId, planId, randomUUID());
    const stored = await pool.query<{ stripe_checkout_session_id: string }>('SELECT stripe_checkout_session_id FROM billing_orders WHERE id=$1', [created.orderId]);
    const paidSession = {
      id: stored.rows[0].stripe_checkout_session_id, livemode: false, mode: 'payment', payment_status: 'paid',
      payment_intent: 'pi_synthetic', customer: 'cus_synthetic', client_reference_id: created.orderId,
      currency: 'czk', amount_subtotal: 9900, total_details: { amount_tax: 0 },
      metadata: { orderId: created.orderId, workspaceId, planVersionId: planId, billingMode: 'test' },
    };
    stripe.checkout.sessions.retrieve.mockResolvedValue(paidSession as never);
    const events = new BillingEvents(pool, stripe as unknown as Stripe, 'test');
    const event = (id: string, type: string, object: object) => ({ id, type, livemode: false, data: { object } }) as Stripe.Event;
    await events.process(event('evt_checkout_1', 'checkout.session.completed', { id: paidSession.id }));
    await events.process(event('evt_checkout_1', 'checkout.session.completed', { id: paidSession.id }));
    await events.process(event('evt_checkout_2', 'checkout.session.completed', { id: paidSession.id }));
    expect((await pool.query('SELECT COALESCE(SUM(amount),0)::int AS credits FROM credit_grants WHERE account_id=$1', [workspaceId])).rows[0].credits).toBe(100);
    await events.process(event('evt_refund_1', 'charge.refunded', { id: 'ch_synthetic' }));
    await events.process(event('evt_refund_1', 'charge.refunded', { id: 'ch_synthetic' }));
    expect((await pool.query('SELECT COALESCE(SUM(amount),0)::int AS credits FROM credit_reversals WHERE account_id=$1', [workspaceId])).rows[0].credits).toBe(50);
    stripe.charges.retrieve.mockResolvedValueOnce({ id: 'ch_synthetic', livemode: false, amount: 9900, amount_refunded: 9900, payment_intent: 'pi_synthetic', customer: 'cus_synthetic' });
    await events.process(event('evt_refund_2', 'charge.refunded', { id: 'ch_synthetic' }));
    expect((await pool.query('SELECT COALESCE(SUM(amount),0)::int AS credits FROM credit_reversals WHERE account_id=$1', [workspaceId])).rows[0].credits).toBe(100);
    expect((await pool.query('SELECT status FROM billing_orders WHERE id=$1', [created.orderId])).rows[0].status).toBe('REFUNDED');
    await events.process(event('evt_dispute_1', 'charge.dispute.created', { charge: 'ch_synthetic' }));
    await events.process(event('evt_refund_late', 'charge.refunded', { id: 'ch_synthetic' }));
    expect((await pool.query('SELECT status,amount_refunded_minor FROM billing_orders WHERE id=$1', [created.orderId])).rows[0]).toMatchObject({ status: 'DISPUTED', amount_refunded_minor: '9900' });
  });

  it('grants a monthly allowance once when invoice arrives before checkout completion', async () => {
    stripe.prices.retrieve.mockResolvedValueOnce({ livemode: false, active: true, currency: 'czk', unit_amount: 9900, product: 'prod_synthetic', type: 'recurring', recurring: { interval: 'month', interval_count: 1 } } as never);
    stripe.checkout.sessions.create.mockResolvedValueOnce({ id: 'cs_test_monthly', livemode: false, url: 'https://checkout.stripe.com/c/monthly', status: 'open' });
    const checkout = new BillingCheckout(pool, stripe as unknown as Stripe, 'test', 'http://127.0.0.1:3005', false);
    const created = await checkout.create(workspaceId, monthlyPlanId, randomUUID());
    const subscription = { id: 'sub_synthetic', livemode: false, customer: 'cus_synthetic', metadata: { orderId: created.orderId }, status: 'active', cancel_at_period_end: false, items: { data: [{ price: { id: 'price_monthly' } }] } };
    const invoice = { id: 'in_synthetic', livemode: false, customer: 'cus_synthetic', parent: { subscription_details: { subscription: 'sub_synthetic' } }, currency: 'czk', lines: { has_more: false, data: [{ pricing: { price_details: { price: 'price_monthly' } }, quantity: 1, parent: { subscription_item_details: { proration: false } } }] }, status: 'paid', billing_reason: 'subscription_create', amount_due: 9900, amount_paid: 9900, total_taxes: [], hosted_invoice_url: 'https://invoice.stripe.com/test', invoice_pdf: null };
    stripe.subscriptions.retrieve.mockResolvedValue(subscription as never);
    stripe.invoices.retrieve.mockResolvedValue(invoice as never);
    const events = new BillingEvents(pool, stripe as unknown as Stripe, 'test');
    const event = (id: string, type: string, object: object) => ({ id, type, livemode: false, data: { object } }) as Stripe.Event;
    await events.process(event('evt_invoice_monthly', 'invoice.paid', { id: invoice.id }));
    expect((await pool.query('SELECT COUNT(*)::int AS count FROM credit_grants WHERE account_id=$1 AND idempotency_key=$2', [workspaceId, 'stripe-test-invoice:in_synthetic'])).rows[0].count).toBe(1);
    const completed = { id: 'cs_test_monthly', livemode: false, mode: 'subscription', subscription: 'sub_synthetic', customer: 'cus_synthetic', client_reference_id: created.orderId, currency: 'czk', amount_subtotal: 9900, metadata: { orderId: created.orderId, workspaceId, planVersionId: monthlyPlanId, billingMode: 'test' } };
    stripe.checkout.sessions.retrieve.mockResolvedValue(completed as never);
    await events.process(event('evt_checkout_monthly', 'checkout.session.completed', { id: completed.id }));
    await events.process(event('evt_invoice_monthly_retry', 'invoice.paid', { id: invoice.id }));
    expect((await pool.query('SELECT COUNT(*)::int AS count FROM credit_grants WHERE account_id=$1 AND idempotency_key=$2', [workspaceId, 'stripe-test-invoice:in_synthetic'])).rows[0].count).toBe(1);
    expect((await pool.query('SELECT status FROM billing_orders WHERE id=$1', [created.orderId])).rows[0].status).toBe('PAID');
    stripe.invoices.retrieve.mockResolvedValueOnce({ ...invoice, id: 'in_cycle', billing_reason: 'subscription_cycle' } as never);
    stripe.invoicePayments.list.mockResolvedValueOnce({ data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_cycle' } }], has_more: false } as never);
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({ id: 'pi_cycle', livemode: false, status: 'succeeded', amount_received: 9900, currency: 'czk', customer: 'cus_synthetic' } as never);
    await events.process(event('evt_invoice_cycle', 'invoice.paid', { id: 'in_cycle' }));
    expect((await pool.query('SELECT COUNT(*)::int AS count FROM credit_grants WHERE account_id=$1 AND idempotency_key LIKE $2', [workspaceId, 'stripe-test-invoice:%'])).rows[0].count).toBe(2);
    stripe.invoices.retrieve.mockResolvedValueOnce({ ...invoice, id: 'in_failed', status: 'open', amount_paid: 0, billing_reason: 'subscription_cycle' } as never);
    await events.process(event('evt_invoice_failed', 'invoice.payment_failed', { id: 'in_failed' }));
    expect((await pool.query('SELECT status FROM billing_subscriptions WHERE mode=$1 AND workspace_id=$2', ['test', workspaceId])).rows[0].status).toBe('past_due');
    expect((await pool.query('SELECT COUNT(*)::int AS count FROM credit_grants WHERE account_id=$1 AND idempotency_key LIKE $2', [workspaceId, 'stripe-test-invoice:%'])).rows[0].count).toBe(2);
  });

  it('replaces a canceled subscription and ignores delayed events from the old one', async () => {
    const oldOrder = await pool.query<{ id: string }>("SELECT id FROM billing_orders WHERE mode='test' AND stripe_subscription_id='sub_synthetic' LIMIT 1");
    expect(oldOrder.rowCount).toBe(1);
    await pool.query("UPDATE billing_subscriptions SET status='canceled' WHERE mode='test' AND workspace_id=$1", [workspaceId]);
    await pool.query("UPDATE billing_orders SET created_at=created_at-interval '1 minute' WHERE id=$1", [oldOrder.rows[0].id]);
    const nextPlan = await pool.query<{ id: string }>(`INSERT INTO billing_plan_versions
      (code,version,kind,name_cs,name_en,description_cs,description_en,currency,amount_minor,monthly_credits,is_visible,is_purchasable,stripe_test_product_id,stripe_test_price_id)
      VALUES ('test-monthly',2,'MONTHLY','Měsíčně II','Monthly II','','','CZK',9900,200,true,true,'prod_synthetic','price_monthly_v2') RETURNING id`);
    stripe.prices.retrieve.mockResolvedValueOnce({ livemode: false, active: true, currency: 'czk', unit_amount: 9900, product: 'prod_synthetic', type: 'recurring', recurring: { interval: 'month', interval_count: 1 } } as never);
    stripe.checkout.sessions.create.mockResolvedValueOnce({ id: 'cs_test_resubscribe', livemode: false, url: 'https://checkout.stripe.com/c/resubscribe', status: 'open' });
    const checkout = new BillingCheckout(pool, stripe as unknown as Stripe, 'test', 'http://127.0.0.1:3005', false);
    const created = await checkout.create(workspaceId, nextPlan.rows[0].id, randomUUID());
    const oldSubscription = { id: 'sub_synthetic', livemode: false, customer: 'cus_synthetic', metadata: { orderId: oldOrder.rows[0].id }, status: 'canceled', cancel_at_period_end: false, items: { data: [{ price: { id: 'price_monthly' } }] } };
    const newSubscription = { ...oldSubscription, id: 'sub_resubscribed', metadata: { orderId: created.orderId }, status: 'active', items: { data: [{ price: { id: 'price_monthly_v2' } }] } };
    stripe.subscriptions.retrieve.mockImplementation(async (subscriptionId: string) => (subscriptionId === newSubscription.id ? newSubscription : oldSubscription) as never);
    const events = new BillingEvents(pool, stripe as unknown as Stripe, 'test');
    const event = (id: string, type: string, object: object) => ({ id, type, livemode: false, data: { object } }) as Stripe.Event;
    await events.process(event('evt_resubscription', 'customer.subscription.created', { id: newSubscription.id }));
    expect((await pool.query('SELECT stripe_subscription_id,status FROM billing_subscriptions WHERE mode=$1 AND workspace_id=$2', ['test', workspaceId])).rows[0]).toMatchObject({ stripe_subscription_id: newSubscription.id, status: 'active' });
    const newInvoice = { id: 'in_resubscribed', livemode: false, customer: 'cus_synthetic', parent: { subscription_details: { subscription: newSubscription.id } }, currency: 'czk',
      lines: { has_more: false, data: [{ pricing: { price_details: { price: 'price_monthly_v2' } }, quantity: 1, parent: { subscription_item_details: { proration: false } } }] },
      status: 'paid', billing_reason: 'subscription_create', amount_due: 9900, amount_paid: 9900, total_taxes: [], hosted_invoice_url: null, invoice_pdf: null };
    stripe.invoices.retrieve.mockResolvedValueOnce(newInvoice as never).mockResolvedValueOnce(newInvoice as never);
    stripe.invoicePayments.list.mockResolvedValueOnce({ data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_resubscribed' } }], has_more: false } as never)
      .mockResolvedValueOnce({ data: [{ status: 'paid', payment: { type: 'payment_intent', payment_intent: 'pi_resubscribed' } }], has_more: false } as never);
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({ id: 'pi_resubscribed', livemode: false, status: 'succeeded', amount_received: 9900, currency: 'czk', customer: 'cus_synthetic' } as never)
      .mockResolvedValueOnce({ id: 'pi_resubscribed', livemode: false, status: 'succeeded', amount_received: 9900, currency: 'czk', customer: 'cus_synthetic' } as never);
    await events.process(event('evt_resub_invoice', 'invoice.paid', { id: newInvoice.id }));
    await events.process(event('evt_resub_invoice_retry', 'invoice.paid', { id: newInvoice.id }));
    expect((await pool.query('SELECT amount FROM credit_grants WHERE account_id=$1 AND idempotency_key=$2', [workspaceId, 'stripe-test-invoice:in_resubscribed'])).rows).toEqual([expect.objectContaining({ amount: 200 })]);
    expect((await pool.query('SELECT plan_version_id,status FROM billing_invoices WHERE stripe_invoice_id=$1', [newInvoice.id])).rows[0]).toMatchObject({ plan_version_id: nextPlan.rows[0].id, status: 'paid' });
    await events.process(event('evt_old_subscription_deleted', 'customer.subscription.deleted', { id: oldSubscription.id }));
    expect((await pool.query('SELECT stripe_subscription_id,status FROM billing_subscriptions WHERE mode=$1 AND workspace_id=$2', ['test', workspaceId])).rows[0]).toMatchObject({ stripe_subscription_id: newSubscription.id, status: 'active' });
    const lateInvoice = { id: 'in_old_failed_late', livemode: false, customer: 'cus_synthetic', parent: { subscription_details: { subscription: oldSubscription.id } }, currency: 'czk', lines: { has_more: false, data: [] }, status: 'open', billing_reason: 'subscription_cycle', amount_due: 9900, amount_paid: 0, total_taxes: [], hosted_invoice_url: null, invoice_pdf: null };
    stripe.invoices.retrieve.mockResolvedValueOnce(lateInvoice as never);
    await events.process(event('evt_old_invoice_failed_late', 'invoice.payment_failed', { id: lateInvoice.id }));
    expect((await pool.query('SELECT stripe_subscription_id,status FROM billing_subscriptions WHERE mode=$1 AND workspace_id=$2', ['test', workspaceId])).rows[0]).toMatchObject({ stripe_subscription_id: newSubscription.id, status: 'active' });
  });

  it('does not grant credits for an underpaid invoice or a live-mode event', async () => {
    const order = await pool.query<{ id: string }>("SELECT id FROM billing_orders WHERE mode='test' AND kind='MONTHLY' LIMIT 1");
    const invoice = { id: 'in_underpaid', livemode: false, customer: 'cus_synthetic', parent: { subscription_details: { subscription: 'sub_synthetic' } }, currency: 'czk', lines: { has_more: false, data: [{ pricing: { price_details: { price: 'price_monthly' } }, quantity: 1, parent: { subscription_item_details: { proration: false } } }] }, status: 'paid', billing_reason: 'subscription_cycle', amount_due: 9900, amount_paid: 100, total_taxes: [], hosted_invoice_url: null, invoice_pdf: null };
    stripe.invoices.retrieve.mockResolvedValueOnce(invoice as never);
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({ id: 'pi_synthetic', livemode: false, status: 'succeeded', amount_received: 100, currency: 'czk', customer: 'cus_synthetic' } as never);
    const events = new BillingEvents(pool, stripe as unknown as Stripe, 'test');
    const event = (id: string, livemode: boolean) => ({ id, type: 'invoice.paid', livemode, data: { object: { id: invoice.id } } }) as Stripe.Event;
    await expect(events.process(event('evt_live_rejected', true))).rejects.toThrow('EVENT_MODE_MISMATCH');
    await expect(events.process(event('evt_underpaid', false))).rejects.toThrow('INVOICE_NOT_ELIGIBLE');
    expect((await pool.query('SELECT COUNT(*)::int AS count FROM billing_webhook_events WHERE stripe_event_id=$1', ['evt_underpaid'])).rows[0].count).toBe(0);
    expect((await pool.query('SELECT COUNT(*)::int AS count FROM credit_grants WHERE account_id=$1 AND idempotency_key=$2', [workspaceId, 'stripe-test-invoice:in_underpaid'])).rows[0].count).toBe(0);
    expect(order.rowCount).toBe(1);
  });

  it('reconciles a refund that happened before the paid checkout webhook', async () => {
    const checkout = new BillingCheckout(pool, stripe as unknown as Stripe, 'test', 'http://127.0.0.1:3005', false);
    const created = await checkout.create(workspaceId, planId, randomUUID());
    const stored = await pool.query<{ stripe_checkout_session_id: string }>('SELECT stripe_checkout_session_id FROM billing_orders WHERE id=$1', [created.orderId]);
    const session = { id: stored.rows[0].stripe_checkout_session_id, livemode: false, mode: 'payment', payment_status: 'paid', payment_intent: 'pi_refunded_early', customer: 'cus_synthetic', client_reference_id: created.orderId, currency: 'czk', amount_subtotal: 9900, total_details: { amount_tax: 0 }, metadata: { orderId: created.orderId, workspaceId, planVersionId: planId, billingMode: 'test' } };
    stripe.checkout.sessions.retrieve.mockResolvedValueOnce(session as never);
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({ id: 'pi_refunded_early', livemode: false, status: 'succeeded', latest_charge: 'ch_refunded_early', amount_received: 9900, currency: 'czk', customer: 'cus_synthetic' } as never);
    stripe.charges.retrieve.mockResolvedValueOnce({ id: 'ch_refunded_early', livemode: false, amount: 9900, amount_refunded: 9900, payment_intent: 'pi_refunded_early', customer: 'cus_synthetic' } as never);
    const event = { id: 'evt_refunded_early', type: 'checkout.session.completed', livemode: false, data: { object: { id: session.id } } } as Stripe.Event;
    await new BillingEvents(pool, stripe as unknown as Stripe, 'test').process(event);
    const granted = await pool.query<{ amount: number }>('SELECT amount FROM credit_grants WHERE account_id=$1 AND idempotency_key=$2', [workspaceId, `stripe-test-checkout:${session.id}`]);
    const reversed = await pool.query<{ amount: number }>('SELECT amount FROM credit_reversals WHERE account_id=$1 AND idempotency_key LIKE $2', [workspaceId, 'stripe-test-refund:ch_refunded_early:%']);
    expect(granted.rows[0].amount).toBe(100);
    expect(reversed.rows[0].amount).toBe(100);
  });

  it('refuses to expose a checkout session if the workspace was deleted while Stripe responded', async () => {
    stripe.checkout.sessions.create.mockImplementationOnce(async () => {
      await pool.query('DELETE FROM local_workspaces WHERE id=$1', [workspaceId]);
      return { id: 'cs_test_after_delete', livemode: false, url: 'https://checkout.stripe.com/c/after-delete', status: 'open' } as never;
    });
    const checkout = new BillingCheckout(pool, stripe as unknown as Stripe, 'test', 'http://127.0.0.1:3005', false);
    await expect(checkout.create(workspaceId, planId, randomUUID())).rejects.toThrow('WORKSPACE_NOT_FOUND');
    expect((await pool.query("SELECT COUNT(*)::int AS count FROM billing_orders WHERE stripe_checkout_session_id='cs_test_after_delete'")).rows[0].count).toBe(0);
  });
});
