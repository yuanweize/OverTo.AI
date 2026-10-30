import type { Pool } from 'pg';

export interface BudgetConfig {
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: 'emergency_disabled' | 'budget_exceeded' | 'budget_check_unavailable';
  dailySpend?: number;
  monthlySpend?: number;
}

export class AiBudgetGuard {
  constructor(private readonly pool?: Pool | null) {}

  async checkBudget(config?: Partial<BudgetConfig>): Promise<BudgetCheckResult> {
    if (process.env.AI_EMERGENCY_DISABLE === 'true') {
      return { allowed: false, reason: 'emergency_disabled' };
    }

    const dailyLimit = config?.dailyBudgetUsd ?? Number(process.env.AI_DAILY_BUDGET_USD || '25.0');
    const monthlyLimit = config?.monthlyBudgetUsd ?? Number(process.env.AI_MONTHLY_BUDGET_USD || '250.0');

    if (!this.pool) {
      // If no database is configured, fail closed if billable AI is requested
      return { allowed: false, reason: 'budget_check_unavailable' };
    }

    try {
      const result = await this.pool.query<{ daily_spend: string; monthly_spend: string }>(`
        SELECT
          COALESCE(SUM(estimated_cost_usd) FILTER (WHERE created_at >= date_trunc('day', now())), 0)::numeric AS daily_spend,
          COALESCE(SUM(estimated_cost_usd) FILTER (WHERE created_at >= date_trunc('month', now())), 0)::numeric AS monthly_spend
        FROM ai_traces
      `);

      const dailySpend = Number(result.rows[0]?.daily_spend || '0');
      const monthlySpend = Number(result.rows[0]?.monthly_spend || '0');

      if (dailySpend >= dailyLimit || monthlySpend >= monthlyLimit) {
        return { allowed: false, reason: 'budget_exceeded', dailySpend, monthlySpend };
      }

      return { allowed: true, dailySpend, monthlySpend };
    } catch {
      // Fail closed
      return { allowed: false, reason: 'budget_check_unavailable' };
    }
  }

  static calculateEstimatedCost(model: string, inputTokens = 0, outputTokens = 0): number {
    // Model pricing per 1,000 tokens (conservative defaults)
    // GPT-4o / GPT-6 tier: ~$0.0025 / 1k in, ~$0.010 / 1k out
    // Mini / Flash tier: ~$0.00015 / 1k in, ~$0.0006 / 1k out
    const isMini = /mini|flash|small/i.test(model);
    const inPerK = isMini ? 0.00015 : 0.0025;
    const outPerK = isMini ? 0.0006 : 0.010;
    const cost = (inputTokens / 1000) * inPerK + (outputTokens / 1000) * outPerK;
    return Math.round(cost * 1000000) / 1000000;
  }
}
