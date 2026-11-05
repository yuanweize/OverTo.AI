import type { Pool } from 'pg';
import { createHash } from 'node:crypto';

export type PlanKind = 'FREE' | 'MONTHLY' | 'CREDIT_PACK';
export type PlanInput = {
  code: string; kind: PlanKind; nameCs: string; nameEn: string;
  descriptionCs: string; descriptionEn: string; currency: 'CZK' | 'EUR' | 'USD';
  amountMinor: number; monthlyCredits: number; packCredits: number;
  isVisible: boolean; isPurchasable: boolean; sortOrder: number;
  stripeTestProductId: string | null; stripeTestPriceId: string | null;
  stripeLiveProductId: string | null; stripeLivePriceId: string | null;
  effectiveAt: string; retiredAt: string | null; reason: string;
};

export type PlanVersion = {
  id: string; code: string; version: number; kind: PlanKind;
  name_cs: string; name_en: string; description_cs: string; description_en: string;
  currency: string; amount_minor: string; monthly_credits: number; pack_credits: number;
  is_visible: boolean; is_purchasable: boolean; sort_order: number;
  stripe_test_product_id: string | null; stripe_test_price_id: string | null;
  stripe_live_product_id: string | null; stripe_live_price_id: string | null;
  effective_at: Date; retired_at: Date | null; created_at: Date;
};

function validate(input: PlanInput) {
  if (!input || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(input.code) ||
      !['FREE', 'MONTHLY', 'CREDIT_PACK'].includes(input.kind) ||
      !['CZK', 'EUR', 'USD'].includes(input.currency) ||
      !Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0 || input.amountMinor > 1000000000 ||
      !Number.isSafeInteger(input.monthlyCredits) || input.monthlyCredits < 0 || input.monthlyCredits > 1000000000 ||
      !Number.isSafeInteger(input.packCredits) || input.packCredits < 0 || input.packCredits > 1000000000 ||
      !Number.isSafeInteger(input.sortOrder) || Math.abs(input.sortOrder) > 100000 ||
      typeof input.isVisible !== 'boolean' || typeof input.isPurchasable !== 'boolean') throw new Error('INVALID_PLAN');
  for (const value of [input.nameCs, input.nameEn]) if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) throw new Error('INVALID_PLAN');
  for (const value of [input.descriptionCs, input.descriptionEn]) if (typeof value !== 'string' || value.length > 500) throw new Error('INVALID_PLAN');
  if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 200) throw new Error('INVALID_PLAN');
  if ((input.kind === 'FREE' && (input.amountMinor !== 0 || input.monthlyCredits !== 0 || input.packCredits !== 0 || input.isPurchasable)) ||
      (input.kind === 'MONTHLY' && (input.amountMinor <= 0 || input.monthlyCredits <= 0 || input.packCredits !== 0)) ||
      (input.kind === 'CREDIT_PACK' && (input.amountMinor <= 0 || input.packCredits <= 0 || input.monthlyCredits !== 0))) throw new Error('INVALID_PLAN');
  for (const [product, price] of [[input.stripeTestProductId, input.stripeTestPriceId], [input.stripeLiveProductId, input.stripeLivePriceId]]) {
    if ((product === null) !== (price === null) || (product !== null && !/^prod_[A-Za-z0-9_]+$/.test(product)) || (price !== null && !/^price_[A-Za-z0-9_]+$/.test(price))) throw new Error('INVALID_STRIPE_MAPPING');
  }
  if (input.isPurchasable && !input.stripeTestPriceId && !input.stripeLivePriceId) throw new Error('PRICE_MAPPING_REQUIRED');
  const effective = new Date(input.effectiveAt);
  const retired = input.retiredAt === null ? null : new Date(input.retiredAt);
  if (!Number.isFinite(effective.getTime()) || (retired && (!Number.isFinite(retired.getTime()) || retired < effective))) throw new Error('INVALID_PLAN_DATE');
}

export class BillingCatalog {
  constructor(private readonly pool: Pool) {}

  async current(visibleOnly = true): Promise<PlanVersion[]> {
    const result = await this.pool.query<PlanVersion>(`SELECT * FROM (
      SELECT DISTINCT ON (code) * FROM billing_plan_versions WHERE effective_at <= now()
      ORDER BY code,effective_at DESC,version DESC
    ) latest WHERE (retired_at IS NULL OR retired_at > now()) AND ($1::boolean=false OR is_visible)
    ORDER BY sort_order,code`, [visibleOnly]);
    return result.rows;
  }

  async history(code?: string): Promise<PlanVersion[]> {
    const result = await this.pool.query<PlanVersion>('SELECT * FROM billing_plan_versions WHERE ($1::text IS NULL OR code=$1) ORDER BY code,version DESC LIMIT 500', [code ?? null]);
    return result.rows;
  }

  async publish(actorId: string, input: PlanInput, requestId: string): Promise<PlanVersion> {
    validate(input);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new Error('INVALID_REQUEST_ID');
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const root = await client.query("SELECT 1 FROM platform_admins WHERE user_id=$1 AND role='ROOT'", [actorId]);
      if (!root.rowCount) throw new Error('FORBIDDEN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`billing-request:${actorId}:${requestId}`]);
      const priorRequest = await client.query<PlanVersion & { request_hash: string }>('SELECT * FROM billing_plan_versions WHERE created_by=$1 AND request_id=$2', [actorId, requestId]);
      if (priorRequest.rowCount) {
        if (priorRequest.rows[0].request_hash !== requestHash) throw new Error('IDEMPOTENCY_CONFLICT');
        await client.query('COMMIT');
        return priorRequest.rows[0];
      }
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`billing-plan:${input.code}`]);
      const prior = await client.query<{ version: number; kind: PlanKind; effective_at: Date }>('SELECT version,kind,effective_at FROM billing_plan_versions WHERE code=$1 ORDER BY version DESC LIMIT 1', [input.code]);
      if (prior.rowCount && prior.rows[0].kind !== input.kind) throw new Error('PLAN_KIND_CONFLICT');
      if (prior.rowCount && new Date(input.effectiveAt) < prior.rows[0].effective_at) throw new Error('PLAN_EFFECTIVE_ORDER');
      const version = (prior.rows[0]?.version ?? 0) + 1;
      const result = await client.query<PlanVersion>(`INSERT INTO billing_plan_versions
        (code,version,kind,name_cs,name_en,description_cs,description_en,currency,amount_minor,monthly_credits,pack_credits,
         is_visible,is_purchasable,sort_order,stripe_test_product_id,stripe_test_price_id,stripe_live_product_id,stripe_live_price_id,
         effective_at,retired_at,created_by,request_id,request_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
      [input.code, version, input.kind, input.nameCs.trim(), input.nameEn.trim(), input.descriptionCs.trim(), input.descriptionEn.trim(),
        input.currency, input.amountMinor, input.monthlyCredits, input.packCredits, input.isVisible, input.isPurchasable, input.sortOrder,
        input.stripeTestProductId, input.stripeTestPriceId, input.stripeLiveProductId, input.stripeLivePriceId,
        new Date(input.effectiveAt), input.retiredAt ? new Date(input.retiredAt) : null, actorId, requestId, requestHash]);
      await client.query('INSERT INTO ai_operations_audit(actor_id,action,target_id,details) VALUES($1,$2,$3,$4)',
        [actorId, 'BILLING_PLAN_PUBLISHED', result.rows[0].id, JSON.stringify({ code: input.code, version, reason: input.reason.trim() })]);
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }
}
