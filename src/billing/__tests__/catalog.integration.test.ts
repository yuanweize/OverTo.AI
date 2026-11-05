// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { BillingCatalog, type PlanInput } from '@/billing/catalog';

const connectionString = process.env.SITE_CONFIG_TEST_DATABASE_URL;
describe.skipIf(!connectionString)('versioned billing catalog on isolated PostgreSQL', () => {
  const schema = `billing_catalog_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString });
  let pool: Pool;
  let catalog: BillingCatalog;
  const root = 'catalog-root';
  const input: PlanInput = {
    code: 'starter-pack', kind: 'CREDIT_PACK', nameCs: 'Balíček', nameEn: 'Pack',
    descriptionCs: 'Kredity pro analýzu', descriptionEn: 'Credits for analysis',
    currency: 'CZK', amountMinor: 9900, monthlyCredits: 0, packCredits: 100,
    isVisible: true, isPurchasable: true, sortOrder: 10,
    stripeTestProductId: 'prod_synthetic', stripeTestPriceId: 'price_synthetic',
    stripeLiveProductId: null, stripeLivePriceId: null,
    effectiveAt: new Date(Date.now() - 60000).toISOString(), retiredAt: null, reason: 'Initial test catalog',
  };
  beforeAll(async () => {
    const url = new URL(connectionString!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/overto_test') throw new Error('Requires a disposable local overto_test database');
    await control.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
    await pool.query('CREATE TABLE "user"(id text PRIMARY KEY)');
    await pool.query(await readFile('migrations/007_platform_settings.sql', 'utf8'));
    await pool.query(await readFile('migrations/010_ai_prompts.sql', 'utf8'));
    await pool.query(await readFile('migrations/021_billing_catalog.sql', 'utf8'));
    await pool.query('INSERT INTO "user"(id) VALUES($1)', [root]);
    await pool.query("INSERT INTO platform_admins(user_id,role) VALUES($1,'ROOT')", [root]);
    catalog = new BillingCatalog(pool);
  });
  afterAll(async () => {
    if (pool) await pool.end();
    await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await control.end();
  });

  it('keeps Free in the public catalog and rejects unauthorized or invalid plans', async () => {
    expect((await catalog.current()).map(plan => plan.code)).toContain('free');
    await expect(catalog.publish('ordinary-user', input, randomUUID())).rejects.toThrow('FORBIDDEN');
    await expect(catalog.publish(root, { ...input, amountMinor: -1 }, randomUUID())).rejects.toThrow('INVALID_PLAN');
    await expect(catalog.publish(root, { ...input, stripeTestPriceId: 'price_other', stripeTestProductId: null }, randomUUID())).rejects.toThrow('INVALID_STRIPE_MAPPING');
  });

  it('publishes immutable versions with stable historic prices and audit rows', async () => {
    const requestId = randomUUID();
    const [first, replay] = await Promise.all([catalog.publish(root, input, requestId), catalog.publish(root, input, requestId)]);
    expect(first.version).toBe(1);
    expect(replay.id).toBe(first.id);
    await expect(catalog.publish(root, { ...input, amountMinor: 12900 }, requestId)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    const second = await catalog.publish(root, { ...input, amountMinor: 12900, stripeTestPriceId: 'price_synthetic_v2', reason: 'Price revision' }, randomUUID());
    expect(second.version).toBe(2);
    expect((await catalog.current()).find(plan => plan.code === input.code)?.amount_minor).toBe('12900');
    expect((await catalog.history(input.code)).map(plan => plan.amount_minor)).toEqual(['12900', '9900']);
    expect((await pool.query("SELECT count(*)::int AS n FROM ai_operations_audit WHERE action='BILLING_PLAN_PUBLISHED'")).rows[0].n).toBe(2);
    await expect(pool.query('UPDATE billing_plan_versions SET amount_minor=1 WHERE id=$1', [first.id])).rejects.toThrow('IMMUTABLE_BILLING_PLAN_VERSION');
    await expect(pool.query('DELETE FROM billing_plan_versions WHERE id=$1', [first.id])).rejects.toThrow('IMMUTABLE_BILLING_PLAN_VERSION');
  });

  it('rolls back the plan version if audit insertion fails', async () => {
    await pool.query("ALTER TABLE ai_operations_audit ADD CONSTRAINT simulated_catalog_audit_failure CHECK (action != 'BILLING_PLAN_PUBLISHED') NOT VALID");
    try {
      await expect(catalog.publish(root, { ...input, reason: 'Fault injection' }, randomUUID())).rejects.toThrow();
      expect((await catalog.history(input.code)).map(plan => plan.version)).toEqual([2, 1]);
    } finally {
      await pool.query('ALTER TABLE ai_operations_audit DROP CONSTRAINT simulated_catalog_audit_failure');
    }
  });
});
