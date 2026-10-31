import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

export interface BudgetConfig {
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  maxCostPerRequestUsd: number;
}

export type BudgetBlockReason =
  | 'emergency_disabled'
  | 'budget_check_unavailable'
  | 'unknown_model_pricing'
  | 'daily_budget_exceeded'
  | 'monthly_budget_exceeded'
  | 'max_request_budget_exceeded';

export interface ReservationResult {
  allowed: boolean;
  reservationId?: string;
  reservedCost?: number;
  reason?: BudgetBlockReason;
  dailySpend?: number;
  monthlySpend?: number;
}

export interface ModelPricing {
  model: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  maxRequestCostUsd: number;
}

export class AiBudgetGuard {
  constructor(private readonly pool?: Pool | null) {}

  /**
   * Concurrency-safe atomic budget reservation.
   * Uses PostgreSQL row/advisory locking to serialize budget check-and-reserve.
   */
  async reserve(params: {
    provider: string;
    model: string;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    customReservationId?: string;
    config?: Partial<BudgetConfig>;
  }): Promise<ReservationResult> {
    if (process.env.AI_EMERGENCY_DISABLE === 'true') {
      return { allowed: false, reason: 'emergency_disabled' };
    }

    if (!this.pool) {
      return { allowed: false, reason: 'budget_check_unavailable' };
    }

    const dailyLimit = params.config?.dailyBudgetUsd ?? Number(process.env.AI_DAILY_BUDGET_USD || '25.0');
    const monthlyLimit = params.config?.monthlyBudgetUsd ?? Number(process.env.AI_MONTHLY_BUDGET_USD || '250.0');
    const maxRequestLimit = params.config?.maxCostPerRequestUsd ?? Number(process.env.AI_MAX_REQUEST_BUDGET_USD || '0.50');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Acquire transaction-scoped advisory lock for AI budget operations
      await client.query("SELECT pg_advisory_xact_lock(hashtext('ai_budget_reservation_lock'))");

      // Auto-expire stale reservations older than their deadline
      await client.query("UPDATE ai_budget_reservations SET status = 'EXPIRED', settled_at = now() WHERE status = 'RESERVED' AND expires_at < now()");

      // Query configured model pricing
      const pricingRes = await client.query<{
        input_per_million_usd: string;
        output_per_million_usd: string;
        max_request_cost_usd: string;
      }>('SELECT input_per_million_usd, output_per_million_usd, max_request_cost_usd FROM ai_model_pricing WHERE model = $1', [params.model]);

      if (!pricingRes.rowCount) {
        await client.query('ROLLBACK');
        return { allowed: false, reason: 'unknown_model_pricing' };
      }

      const inputPrice = Number(pricingRes.rows[0].input_per_million_usd) / 1_000_000;
      const outputPrice = Number(pricingRes.rows[0].output_per_million_usd) / 1_000_000;
      const modelMax = Number(pricingRes.rows[0].max_request_cost_usd);

      const maxIn = params.maxInputTokens ?? 3000;
      const maxOut = params.maxOutputTokens ?? 1000;
      const calculatedMax = Math.round((maxIn * inputPrice + maxOut * outputPrice) * 1_000_000) / 1_000_000;

      // Fail-closed ceiling validation: potential request cost cannot exceed model ceiling or request budget cap.
      // Never artificially depress the reservation below its potential cost via Math.min.
      if (modelMax > 0 && calculatedMax > modelMax) {
        await client.query('ROLLBACK');
        return { allowed: false, reason: 'max_request_budget_exceeded' };
      }

      if (calculatedMax > maxRequestLimit) {
        await client.query('ROLLBACK');
        return { allowed: false, reason: 'max_request_budget_exceeded' };
      }

      const reservedCost = calculatedMax;

      // Query aggregate active reservations and settled spend.
      // Invariant: EXPIRED reservations reflect potential external charges (e.g. app crashed during upstream call)
      // and must remain counted until audited/reconciled, preventing budget overspend across restarts.
      const spendRes = await client.query<{ daily_spend: string; monthly_spend: string }>(`
        SELECT
          COALESCE(SUM(COALESCE(settled_amount_usd, reserved_amount_usd))
            FILTER (WHERE created_at >= date_trunc('day', now()) AND status IN ('RESERVED', 'SETTLED', 'EXPIRED')), 0)::numeric AS daily_spend,
          COALESCE(SUM(COALESCE(settled_amount_usd, reserved_amount_usd))
            FILTER (WHERE created_at >= date_trunc('month', now()) AND status IN ('RESERVED', 'SETTLED', 'EXPIRED')), 0)::numeric AS monthly_spend
        FROM ai_budget_reservations
      `);

      const currentDaily = Number(spendRes.rows[0]?.daily_spend || '0');
      const currentMonthly = Number(spendRes.rows[0]?.monthly_spend || '0');

      if (currentDaily + reservedCost > dailyLimit) {
        await client.query('ROLLBACK');
        return { allowed: false, reason: 'daily_budget_exceeded', dailySpend: currentDaily, monthlySpend: currentMonthly };
      }

      if (currentMonthly + reservedCost > monthlyLimit) {
        await client.query('ROLLBACK');
        return { allowed: false, reason: 'monthly_budget_exceeded', dailySpend: currentDaily, monthlySpend: currentMonthly };
      }

      const reservationId = params.customReservationId || randomUUID();
      await client.query(`
        INSERT INTO ai_budget_reservations (id, provider, model, reserved_amount_usd, status, expires_at)
        VALUES ($1, $2, $3, $4, 'RESERVED', now() + interval '2 minutes')
      `, [reservationId, params.provider, params.model, reservedCost]);

      await client.query('COMMIT');
      return {
        allowed: true,
        reservationId,
        reservedCost,
        dailySpend: currentDaily + reservedCost,
        monthlySpend: currentMonthly + reservedCost,
      };
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      return { allowed: false, reason: 'budget_check_unavailable' };
    } finally {
      client.release();
    }
  }

  /**
   * Settle an active reservation with actual token usage.
   * If token count is missing, settles conservatively at the reserved ceiling.
   */
  async settle(
    reservationId: string,
    usage: { inputTokens?: number; outputTokens?: number }
  ): Promise<{ settledCost: number }> {
    if (!this.pool) throw new Error('BUDGET_POOL_UNAVAILABLE');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query<{ model: string; reserved_amount_usd: string }>(
        "SELECT model, reserved_amount_usd FROM ai_budget_reservations WHERE id = $1 AND status = 'RESERVED' FOR UPDATE",
        [reservationId]
      );

      if (!res.rowCount) {
        await client.query('ROLLBACK');
        return { settledCost: 0 };
      }

      const { model, reserved_amount_usd } = res.rows[0];
      const reservedCeiling = Number(reserved_amount_usd);
      let actualCost = reservedCeiling;

      if (
        typeof usage.inputTokens === 'number' &&
        typeof usage.outputTokens === 'number' &&
        usage.inputTokens >= 0 &&
        usage.outputTokens >= 0
      ) {
        const pricingRes = await client.query<{
          input_per_million_usd: string;
          output_per_million_usd: string;
        }>('SELECT input_per_million_usd, output_per_million_usd FROM ai_model_pricing WHERE model = $1', [model]);

        if (pricingRes.rowCount) {
          const inPrice = Number(pricingRes.rows[0].input_per_million_usd) / 1_000_000;
          const outPrice = Number(pricingRes.rows[0].output_per_million_usd) / 1_000_000;
          const computed = usage.inputTokens * inPrice + usage.outputTokens * outPrice;
          const roundedComputed = Math.round(computed * 1_000_000) / 1_000_000;
          // Invariant: Settled amount must NEVER exceed the reserved ceiling
          actualCost = Math.min(roundedComputed, reservedCeiling);
        }
      }

      await client.query(
        "UPDATE ai_budget_reservations SET status = 'SETTLED', settled_amount_usd = $1, settled_at = now() WHERE id = $2",
        [actualCost, reservationId]
      );
      await client.query('COMMIT');
      return { settledCost: actualCost };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Immediately release an active reservation if a call failed or timed out.
   */
  async release(reservationId: string): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        "UPDATE ai_budget_reservations SET status = 'RELEASED', settled_at = now() WHERE id = $1 AND status = 'RESERVED'",
        [reservationId]
      );
    } catch {
      // Ignored: expires_at will clean it up automatically
    }
  }

  /**
   * Reconcile expired reservations.
   */
  async reconcile(): Promise<{ expiredCount: number }> {
    if (!this.pool) return { expiredCount: 0 };
    const res = await this.pool.query(
      "UPDATE ai_budget_reservations SET status = 'EXPIRED', settled_at = now() WHERE status = 'RESERVED' AND expires_at < now()"
    );
    return { expiredCount: res.rowCount ?? 0 };
  }

  /**
   * General non-locking query for current spend status.
   */
  async checkBudget(config?: Partial<BudgetConfig>): Promise<{
    allowed: boolean;
    reason?: 'emergency_disabled' | 'budget_exceeded' | 'budget_check_unavailable';
    dailySpend?: number;
    monthlySpend?: number;
  }> {
    if (process.env.AI_EMERGENCY_DISABLE === 'true') {
      return { allowed: false, reason: 'emergency_disabled' };
    }

    const dailyLimit = config?.dailyBudgetUsd ?? Number(process.env.AI_DAILY_BUDGET_USD || '25.0');
    const monthlyLimit = config?.monthlyBudgetUsd ?? Number(process.env.AI_MONTHLY_BUDGET_USD || '250.0');

    if (!this.pool) {
      return { allowed: false, reason: 'budget_check_unavailable' };
    }

    try {
      const result = await this.pool.query<{ daily_spend: string; monthly_spend: string }>(`
        SELECT
          COALESCE(SUM(COALESCE(settled_amount_usd, reserved_amount_usd))
            FILTER (WHERE created_at >= date_trunc('day', now()) AND status IN ('RESERVED', 'SETTLED', 'EXPIRED')), 0)::numeric AS daily_spend,
          COALESCE(SUM(COALESCE(settled_amount_usd, reserved_amount_usd))
            FILTER (WHERE created_at >= date_trunc('month', now()) AND status IN ('RESERVED', 'SETTLED', 'EXPIRED')), 0)::numeric AS monthly_spend
        FROM ai_budget_reservations
      `);

      const dailySpend = Number(result.rows[0]?.daily_spend || '0');
      const monthlySpend = Number(result.rows[0]?.monthly_spend || '0');

      if (dailySpend >= dailyLimit || monthlySpend >= monthlyLimit) {
        return { allowed: false, reason: 'budget_exceeded', dailySpend, monthlySpend };
      }

      return { allowed: true, dailySpend, monthlySpend };
    } catch {
      return { allowed: false, reason: 'budget_check_unavailable' };
    }
  }

  /**
   * Admin pricing management.
   */
  static async setModelPricing(
    pool: Pool,
    pricing: ModelPricing
  ): Promise<void> {
    await pool.query(
      `INSERT INTO ai_model_pricing (model, input_per_million_usd, output_per_million_usd, max_request_cost_usd, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (model) DO UPDATE SET
         input_per_million_usd = excluded.input_per_million_usd,
         output_per_million_usd = excluded.output_per_million_usd,
         max_request_cost_usd = excluded.max_request_cost_usd,
         updated_at = now()`,
      [pricing.model, pricing.inputPerMillionUsd, pricing.outputPerMillionUsd, pricing.maxRequestCostUsd]
    );
  }
}
