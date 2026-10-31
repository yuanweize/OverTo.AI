// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { AiBudgetGuard } from '../budgets';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const testDbUrl =
  process.env.TEST_DATABASE_URL ||
  process.env.SITE_CONFIG_TEST_DATABASE_URL ||
  process.env.DATABASE_URL;

describe('AI budget guard & atomic concurrency reservation', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('immediately blocks AI when AI_EMERGENCY_DISABLE is true', async () => {
    vi.stubEnv('AI_EMERGENCY_DISABLE', 'true');
    const guard = new AiBudgetGuard(null);
    const check = await guard.reserve({ provider: 'test', model: 'gpt-4o' });
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('emergency_disabled');
  });

  it('fails closed when database is missing', async () => {
    const guard = new AiBudgetGuard(null);
    const check = await guard.reserve({ provider: 'test', model: 'gpt-4o' });
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('budget_check_unavailable');
  });

  describe.skipIf(!testDbUrl)('PostgreSQL atomic reservation & concurrency integration', () => {
    let control: Pool;
    let pool: Pool;
    const schema = `budget_test_${randomUUID().replaceAll('-', '')}`;

    beforeAll(async () => {
      control = new Pool({ connectionString: testDbUrl });
      await control.query(`CREATE SCHEMA ${schema}`);
      pool = new Pool({ connectionString: testDbUrl, options: `-c search_path=${schema}` });
      const migrationSql = await readFile('migrations/016_ai_budget_reservations.sql', 'utf8');
      await pool.query(migrationSql);
      const migration17Sql = await readFile('migrations/017_ai_budget_accounting.sql', 'utf8');
      await pool.query(migration17Sql);
    });

    afterAll(async () => {
      if (pool) await pool.end().catch(() => {});
      if (control) {
        await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
        await control.end().catch(() => {});
      }
    });

    it('fails closed when model pricing is unknown (no name guessing)', async () => {
      const guard = new AiBudgetGuard(pool);
      const res = await guard.reserve({ provider: 'openai', model: 'unknown-experimental-model-9000' });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('unknown_model_pricing');
    });

    it('reserves budget atomically for a known model', async () => {
      const guard = new AiBudgetGuard(pool);
      const res = await guard.reserve({
        provider: 'openai',
        model: 'gpt-4o-mini',
        maxInputTokens: 1000,
        maxOutputTokens: 500,
        config: { dailyBudgetUsd: 1.0, monthlyBudgetUsd: 10.0 },
      });

      expect(res.allowed).toBe(true);
      expect(res.reservationId).toBeDefined();
      expect(res.reservedCost).toBeGreaterThan(0);

      // Verify row in database
      const row = await pool.query('SELECT status, reserved_amount_usd FROM ai_budget_reservations WHERE id = $1', [res.reservationId]);
      expect(row.rows[0].status).toBe('RESERVED');
      expect(Number(row.rows[0].reserved_amount_usd)).toBe(res.reservedCost);
    });

    it('settles reservation with actual token usage', async () => {
      const guard = new AiBudgetGuard(pool);
      const res = await guard.reserve({
        provider: 'openai',
        model: 'gpt-4o',
        maxInputTokens: 2000,
        maxOutputTokens: 1000,
      });
      expect(res.allowed).toBe(true);

      const settleRes = await guard.settle(res.reservationId!, {
        inputTokens: 500,
        outputTokens: 200,
      });

      expect(settleRes.settledCost).toBeGreaterThan(0);
      const row = await pool.query('SELECT status, settled_amount_usd FROM ai_budget_reservations WHERE id = $1', [res.reservationId]);
      expect(row.rows[0].status).toBe('SETTLED');
      expect(Number(row.rows[0].settled_amount_usd)).toBe(settleRes.settledCost);
    });

    it('releases reservation immediately on failure so funds are freed', async () => {
      const guard = new AiBudgetGuard(pool);
      const res = await guard.reserve({
        provider: 'openai',
        model: 'gpt-4o',
        config: { dailyBudgetUsd: 0.10 },
      });
      expect(res.allowed).toBe(true);

      // Release reservation
      await guard.release(res.reservationId!);
      const row = await pool.query('SELECT status FROM ai_budget_reservations WHERE id = $1', [res.reservationId]);
      expect(row.rows[0].status).toBe('RELEASED');

      // The released amount should not count against active budget
      const check = await guard.checkBudget({ dailyBudgetUsd: 0.10 });
      expect(check.allowed).toBe(true);
    });

    it('settles conservatively at reserved ceiling when tokens are missing', async () => {
      const guard = new AiBudgetGuard(pool);
      const res = await guard.reserve({
        provider: 'openai',
        model: 'gpt-4o-mini',
      });
      expect(res.allowed).toBe(true);

      const settleRes = await guard.settle(res.reservationId!, {});
      expect(settleRes.settledCost).toBe(res.reservedCost);
    });

    it('separately records reserved amount, actual cost, and overage anomalies without truncation', async () => {
      const guard = new AiBudgetGuard(pool);
      await pool.query('DELETE FROM ai_budget_reservations');

      // Configure a test model where 1000 output tokens cost $0.25
      await AiBudgetGuard.setModelPricing(pool, {
        model: 'test-high-cost-model',
        inputPerMillionUsd: 10.0,
        outputPerMillionUsd: 250.0,
        maxRequestCostUsd: 0.20, // Model max ceiling is $0.20
      });

      // 1. When max potential tokens exceed model ceiling ($0.25 > $0.20), reservation MUST be rejected fail-closed!
      const overCeiling = await guard.reserve({
        provider: 'test',
        model: 'test-high-cost-model',
        maxInputTokens: 0,
        maxOutputTokens: 1000, // 1000 * $250 / 1M = $0.25 > $0.20 model ceiling
        config: { dailyBudgetUsd: 0.20 },
      });
      expect(overCeiling.allowed).toBe(false);
      expect(overCeiling.reason).toBe('max_request_budget_exceeded');

      // 2. Reservation approved for exactly $0.20
      await AiBudgetGuard.setModelPricing(pool, {
        model: 'test-ceiling-model',
        inputPerMillionUsd: 10.0,
        outputPerMillionUsd: 200.0,
        maxRequestCostUsd: 0.20,
      });

      const allowedRes = await guard.reserve({
        provider: 'test',
        model: 'test-ceiling-model',
        maxInputTokens: 0,
        maxOutputTokens: 1000, // 1000 * $200 / 1M = $0.20 == ceiling
        config: { dailyBudgetUsd: 0.20 },
      });
      expect(allowedRes.allowed).toBe(true);
      expect(allowedRes.reservedCost).toBe(0.20);

      // Attempt to settle with token usage that calculates to $0.50 (overage anomaly)
      const settleRes = await guard.settle(allowedRes.reservationId!, {
        inputTokens: 0,
        outputTokens: 2500, // 2500 * $200 / 1M = $0.50
      });

      // Actual cost must NOT be truncated to $0.20 to fabricate lower spend!
      expect(settleRes.actualCost).toBe(0.50);
      expect(settleRes.settledCost).toBe(0.50);
      expect(settleRes.reservedCost).toBe(0.20);
      expect(settleRes.isOverage).toBe(true);
      expect(settleRes.overageAmount).toBe(0.30);
      expect(settleRes.overageReason).toBe('usage_exceeded_reservation');

      // Verify row in database separately records reserved and actual amounts with overage flags
      const row = await pool.query(
        'SELECT reserved_amount_usd, actual_amount_usd, settled_amount_usd, is_overage, overage_amount_usd, overage_reason FROM ai_budget_reservations WHERE id = $1',
        [allowedRes.reservationId]
      );
      expect(Number(row.rows[0].reserved_amount_usd)).toBe(0.20);
      expect(Number(row.rows[0].actual_amount_usd)).toBe(0.50);
      expect(Number(row.rows[0].settled_amount_usd)).toBe(0.50);
      expect(row.rows[0].is_overage).toBe(true);
      expect(Number(row.rows[0].overage_amount_usd)).toBe(0.30);
      expect(row.rows[0].overage_reason).toBe('usage_exceeded_reservation');

      // Verify that total daily spend in DB accurately reflects $0.50 and blocks subsequent calls
      const nextRes = await guard.reserve({
        provider: 'test',
        model: 'test-ceiling-model',
        maxInputTokens: 0,
        maxOutputTokens: 100,
        config: { dailyBudgetUsd: 0.20 },
      });
      expect(nextRes.allowed).toBe(false);
      expect(nextRes.reason).toBe('daily_budget_exceeded');
    });

    it('CRITICAL CONCURRENCY TEST: 10 concurrent requests competing for tight budget never overspend', async () => {
      const guard = new AiBudgetGuard(pool);
      // Clean previous reservations for this test
      await pool.query('DELETE FROM ai_budget_reservations');

      // Set a tight daily budget of exactly $0.05
      // Each gpt-4o reservation requests up to $0.02
      // Therefore, at most 2 requests can succeed! The rest MUST be rejected!
      const promises = Array.from({ length: 10 }).map(() =>
        guard.reserve({
          provider: 'openai',
          model: 'gpt-4o',
          maxInputTokens: 4000,
          maxOutputTokens: 1000,
          customReservationId: randomUUID(),
          config: { dailyBudgetUsd: 0.05, monthlyBudgetUsd: 10.0 },
        })
      );

      const results = await Promise.all(promises);
      const allowed = results.filter(r => r.allowed);
      const blocked = results.filter(r => !r.allowed);

      expect(allowed.length).toBeGreaterThan(0);
      expect(blocked.length).toBeGreaterThan(0);

      // Verify sum of allowed reserved amounts in DB is <= $0.05
      const sumRes = await pool.query<{ total: string }>(
        "SELECT COALESCE(SUM(reserved_amount_usd), 0)::numeric AS total FROM ai_budget_reservations WHERE status = 'RESERVED'"
      );
      const totalReserved = Number(sumRes.rows[0].total);
      expect(totalReserved).toBeLessThanOrEqual(0.05);

      // Clean up reservations
      for (const r of allowed) {
        await guard.release(r.reservationId!);
      }
    });

    it('crash recovery: expired reservations older than 2 minutes are automatically reclaimed and counted in spend', async () => {
      const guard = new AiBudgetGuard(pool);
      const oldId = randomUUID();

      // Insert simulated crashed reservation with past expires_at
      await pool.query(
        "INSERT INTO ai_budget_reservations (id, provider, model, reserved_amount_usd, status, expires_at) VALUES ($1, 'test', 'gpt-4o', 0.10, 'RESERVED', now() - interval '5 minutes')",
        [oldId]
      );

      const reconciled = await guard.reconcile();
      expect(reconciled.expiredCount).toBeGreaterThanOrEqual(1);

      const row = await pool.query('SELECT status FROM ai_budget_reservations WHERE id = $1', [oldId]);
      expect(row.rows[0].status).toBe('EXPIRED');

      // Crucial invariant: Expired reservation must STILL be counted towards budget to prevent overspend on crash
      const check = await guard.checkBudget({ dailyBudgetUsd: 0.15 });
      expect(check.dailySpend).toBeGreaterThanOrEqual(0.10);
    });
  });
});
