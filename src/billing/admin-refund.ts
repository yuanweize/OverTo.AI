import type { Pool } from 'pg';
import type Stripe from 'stripe';

type RefundTarget = {
  id: string; mode: 'test' | 'live'; workspace_id: string; status: string;
  stripe_customer_id: string | null; stripe_payment_intent_id: string | null; currency: string;
};

/** Submit a full order or renewal-invoice refund. Signed webhooks own ledger reversal. */
export async function submitBillingRefund(pool: Pool, stripe: Stripe, input: {
  actorId: string; targetId: string; targetKind: 'order' | 'invoice'; reason: string; mode: 'test' | 'live';
}) {
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 300 ||
      !(input.targetKind === 'order' ? /^[0-9a-f-]{36}$/i.test(input.targetId) : /^in_[A-Za-z0-9]+$/.test(input.targetId))) throw new Error('INVALID_INPUT');
  const target = (await pool.query<RefundTarget>(input.targetKind === 'order'
    ? 'SELECT id,mode,workspace_id,status,stripe_customer_id,stripe_payment_intent_id,currency FROM billing_orders WHERE id=$1 AND mode=$2'
    : `SELECT i.stripe_invoice_id AS id,i.mode,i.workspace_id,i.status,c.stripe_customer_id,i.stripe_payment_intent_id,i.currency
       FROM billing_invoices i JOIN billing_customers c ON c.mode=i.mode AND c.workspace_id=i.workspace_id
       WHERE i.stripe_invoice_id=$1 AND i.mode=$2`,
    [input.targetId, input.mode],
  )).rows[0];
  const allowed = input.targetKind === 'order' ? ['PAID', 'PARTIAL_REFUND'] : ['paid', 'partial_refund'];
  if (!target || !allowed.includes(target.status) || !target.stripe_customer_id || !target.stripe_payment_intent_id)
    throw new Error('ORDER_NOT_REFUNDABLE');

  // Read Stripe before any DB transaction. Stripe's deterministic idempotency
  // key makes concurrent retries unable to produce a second refund.
  const intent = await stripe.paymentIntents.retrieve(target.stripe_payment_intent_id);
  const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id;
  if (!chargeId || intent.livemode !== (input.mode === 'live') || intent.status !== 'succeeded' ||
      (typeof intent.customer === 'string' ? intent.customer : intent.customer?.id) !== target.stripe_customer_id ||
      intent.currency.toUpperCase() !== target.currency) throw new Error('PAYMENT_MISMATCH');
  const charge = await stripe.charges.retrieve(chargeId);
  if (charge.livemode !== (input.mode === 'live') || charge.payment_intent !== intent.id ||
      (typeof charge.customer === 'string' ? charge.customer : charge.customer?.id) !== target.stripe_customer_id ||
      charge.currency.toUpperCase() !== target.currency || charge.amount !== intent.amount_received ||
      !Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > charge.amount)
    throw new Error('PAYMENT_MISMATCH');
  if (charge.amount_refunded === charge.amount) throw new Error('ALREADY_REFUNDED');

  // Record who requested the operation before making the external call.
  // No credit mutation happens here; only the verified webhook may reverse it.
  const audit = await pool.query(`INSERT INTO ai_operations_audit(actor_id,action,target_id,details)
    SELECT $1,'BILLING_REFUND_REQUESTED',$2,$3 FROM platform_admins WHERE user_id=$1 AND role='ROOT' RETURNING id`,
  [input.actorId, input.targetId, JSON.stringify({ mode: input.mode, targetKind: input.targetKind, workspaceId: target.workspace_id, reason, chargeId })]);
  if (!audit.rowCount) throw new Error('FORBIDDEN');

  const refund = await stripe.refunds.create({ charge: charge.id, amount: charge.amount - charge.amount_refunded,
    reason: 'requested_by_customer', metadata: { targetId: target.id, targetKind: input.targetKind, operator: input.actorId } },
  { idempotencyKey: `overto-${input.mode}-${input.targetKind}-${target.id}-full-refund` });
  await pool.query(`INSERT INTO ai_operations_audit(actor_id,action,target_id,details)
    VALUES($1,'BILLING_REFUND_SUBMITTED',$2,$3)`,
  [input.actorId, input.targetId, JSON.stringify({ mode: input.mode, targetKind: input.targetKind, refundId: refund.id, status: refund.status, amount: refund.amount })]);
  return { status: refund.status, amount: refund.amount, currency: target.currency };
}
