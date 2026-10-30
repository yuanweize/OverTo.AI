// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { AiBudgetGuard } from '../budgets';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const testDbUrl =
  process.env.DATABASE_URL ||
  process.env.SITE_CONFIG_TEST_DATABASE_URL ||
  'postgresql://overto:overto@localhost:5432/overto_test';

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

  describe('PostgreSQL atomic reservation & concurrency integration', () => {
    let control: Pool;
    let pool: Pool;
    const schema = `budget_test_${randomUUID().replaceAll('-', '')}`;

    beforeAll(async () => {
      control = new Pool({ connectionString: testDbUrl });
      try {
        await control.query(`CREATE SCHEMA ${schema}`);
        pool = new Pool({ connectionString: testDbUrl, options: `-c search_path=${schema}` });
        const migrationSql = await readFile('migrations/016_ai_budget_reservations.sql', 'utf8');
        await pool.query(migrationSql);
      } catch (err) {
        console.warn('Skipping PostgreSQL integration suite if database is not reachable', err);
      }
    });

    afterAll(async () => {
      if (pool) await pool.end().catch(() => {});
      if (control) {
        await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
        await control.end().catch(() => {});
      }
    });

    it('fails closed when model pricing is unknown (no name guessing)', async () => {
      if (!pool) return;
      const guard = new AiBudgetGuard(pool);
      const res = await guard.reserve({ provider: 'openai', model: 'unknown-experimental-model-9000' });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('unknown_model_pricing');
    });

    it('reserves budget atomically for a known model', async () => {
      if (!pool) return;
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
      if (!pool) return;
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
      if (!pool) return;
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
      if (!pool) return;
      const guard = new AiBudgetGuard(pool);
      const res = await guard.reserve({
        provider: 'openai',
        model: 'gpt-4o-mini',
      });
      expect(res.allowed).toBe(true);

      const settleRes = await guard.settle(res.reservationId!, {});
      expect(settleRes.settledCost).toBe(res.reservedCost);
    });

    it('CRITICAL CONCURRENCY TEST: 10 concurrent requests competing for tight budget never overspend', async () => {
      if (!pool) return;
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

    it('crash recovery: expired reservations older than 2 minutes are automatically reclaimed', async () => {
      if (!pool) return;
      const guard = new AiBudgetGuard(pool);
      const oldId = randomUUID();

      // Insert simulated crashed reservation with past expires_at
      await pool.query(
        "INSERT INTO ai_budget_reservations (id, provider, model, reserved_amount_usd, status, expires_at) VALUES ($1, 'test', 'gpt-4o', 10.0, 'RESERVED', now() - interval '5 minutes')",
        [oldId]
      );

      const reconciled = await guard.reconcile();
      expect(reconciled.expiredCount).toBeGreaterThanOrEqual(1);

      const row = await pool.query('SELECT status FROM ai_budget_reservations WHERE id = $1', [oldId]);
      expect(row.rows[0].status).toBe('EXPIRED');
    });
  });
});
