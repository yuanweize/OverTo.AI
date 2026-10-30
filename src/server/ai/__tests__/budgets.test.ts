import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiBudgetGuard } from '../budgets';
import type { Pool } from 'pg';

describe('AI budget guard & cost calculator', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('immediately blocks AI when AI_EMERGENCY_DISABLE is true', async () => {
    vi.stubEnv('AI_EMERGENCY_DISABLE', 'true');
    const guard = new AiBudgetGuard(null);
    const check = await guard.checkBudget();
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('emergency_disabled');
  });

  it('fails closed when database is missing and emergency is false', async () => {
    const guard = new AiBudgetGuard(null);
    const check = await guard.checkBudget();
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('budget_check_unavailable');
  });

  it('allows request when spend is below limits', async () => {
    const mockPool = {
      query: vi.fn(async () => ({
        rows: [{ daily_spend: '2.50', monthly_spend: '15.00' }],
      })),
    } as unknown as Pool;

    const guard = new AiBudgetGuard(mockPool);
    const check = await guard.checkBudget({ dailyBudgetUsd: 10.0, monthlyBudgetUsd: 100.0 });
    expect(check.allowed).toBe(true);
    expect(check.dailySpend).toBe(2.5);
    expect(check.monthlySpend).toBe(15);
  });

  it('blocks request when daily spend exceeds limit', async () => {
    const mockPool = {
      query: vi.fn(async () => ({
        rows: [{ daily_spend: '10.50', monthly_spend: '15.00' }],
      })),
    } as unknown as Pool;

    const guard = new AiBudgetGuard(mockPool);
    const check = await guard.checkBudget({ dailyBudgetUsd: 10.0, monthlyBudgetUsd: 100.0 });
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('budget_exceeded');
  });

  it('calculates cost conservatively based on model and token counts', () => {
    const costStandard = AiBudgetGuard.calculateEstimatedCost('gpt-6.1-sol', 1000, 500);
    // (1 * 0.0025) + (0.5 * 0.010) = 0.0025 + 0.0050 = 0.0075
    expect(costStandard).toBe(0.0075);

    const costMini = AiBudgetGuard.calculateEstimatedCost('gpt-4o-mini', 1000, 1000);
    // (1 * 0.00015) + (1 * 0.0006) = 0.00075
    expect(costMini).toBe(0.00075);
  });
});
