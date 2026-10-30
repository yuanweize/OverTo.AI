// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PromptRepository } from '@/ai/prompts/repository';
import { TraceRepository } from '@/ai/traces/repository';
import { analyzeSuspiciousMessage } from '@/lib/decision-engine';
import { defaultProviderSettings } from '@/ai/providers-config';

const connectionString = process.env.SITE_CONFIG_TEST_DATABASE_URL;

describe.skipIf(!connectionString)('runtime prompt activation and rollback chain with traces', () => {
  const schema = `prompt_chain_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString });
  let pool: Pool;
  let promptRepo: PromptRepository;
  let traceRepo: TraceRepository;
  const rootId = 'root-chain-user';
  const modelName = 'gpt-6.1-mock';

  beforeAll(async () => {
    await control.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
    promptRepo = new PromptRepository(pool);
    traceRepo = new TraceRepository(pool);

    await pool.query('CREATE TABLE "user" (id text PRIMARY KEY, "emailVerified" boolean DEFAULT true)');
    await pool.query('INSERT INTO "user" (id, "emailVerified") VALUES ($1, true)', [rootId]);
    await pool.query(await readFile('migrations/007_platform_settings.sql', 'utf8'));
    await pool.query(await readFile('migrations/008_ai_traces.sql', 'utf8'));
    await pool.query(await readFile('migrations/010_ai_prompts.sql', 'utf8'));
    await pool.query(await readFile('migrations/011_prompt_test_metrics.sql', 'utf8'));
    await pool.query(await readFile('migrations/013_ai_provider_settings.sql', 'utf8'));
    await pool.query("INSERT INTO platform_admins (user_id, role) VALUES ($1, 'ROOT')", [rootId]);
  });

  afterAll(async () => {
    if (pool) await pool.end();
    await control.query(`DROP SCHEMA ${schema} CASCADE`);
    await control.end();
  });

  it('executes full chain: Create -> Test -> Activate -> Run Engine -> Record Trace -> Activate B -> Rollback to A', async () => {
    // 1. Create Prompt Version A
    const idA = await promptRepo.create(rootId, {
      name: 'Prompt Version A',
      instructions: 'Analyze suspicious Czech messages with high confidence and precision rules.',
    });
    expect(idA).toMatch(/^[0-9a-f-]{36}$/);

    // 2. Test Prompt Version A
    await promptRepo.recordTest(rootId, idA, modelName, {
      status: 'SUCCESS',
      inputTokens: 120,
      outputTokens: 85,
    }, 150);

    // 3. Activate Prompt Version A (optimistic lock version 0 -> 1)
    await promptRepo.activate(rootId, idA, 0, modelName);
    const activeA = await promptRepo.active();
    expect(activeA.version).toBe(idA);

    // 4. Fraud engine uses Prompt Version A
    const settings = { ...defaultProviderSettings(), enabled: false }; // engine runs rules with prompt instructions metadata
    const resultA = await analyzeSuspiciousMessage(
      'Ahoj mami, mám nové číslo. Pošli mi ihned 20 000 Kč na účet.',
      false,
      'cs',
      activeA,
      settings
    );
    expect(resultA.riskLevel).toBe('HIGH_RISK');

    // 5. Trace records Prompt Version A
    const traceIdA = randomUUID();
    await traceRepo.record({
      id: traceIdA,
      provider: 'Compatible Mock Gateway',
      model: modelName,
      promptVersion: activeA.version,
      status: 'SUCCESS',
      failureReason: null,
      durationMs: 125,
      inputTokens: 120,
      outputTokens: 85,
      rejectedEvidence: 0,
      estimatedCostUsd: 0.00115,
    });

    const recordedTraceA = await pool.query('SELECT prompt_version, model, status, estimated_cost_usd FROM ai_traces WHERE id=$1', [traceIdA]);
    expect(recordedTraceA.rows[0].prompt_version).toBe(idA);
    expect(recordedTraceA.rows[0].status).toBe('SUCCESS');

    // 6. Create & Activate Prompt Version B
    const idB = await promptRepo.create(rootId, {
      name: 'Prompt Version B',
      instructions: 'Second iteration with stricter phishing URL grounding rules.',
    });
    await promptRepo.recordTest(rootId, idB, modelName, {
      status: 'SUCCESS',
      inputTokens: 140,
      outputTokens: 90,
    }, 140);
    await promptRepo.activate(rootId, idB, 1, modelName);

    const activeB = await promptRepo.active();
    expect(activeB.version).toBe(idB);

    // 7. Rollback: Activate Prompt Version A again (optimistic lock version 2 -> 3)
    await promptRepo.activate(rootId, idA, 2, modelName);
    const activeRollback = await promptRepo.active();
    expect(activeRollback.version).toBe(idA);

    // 8. Fraud Engine uses rolled back version A
    const resultRollback = await analyzeSuspiciousMessage(
      'Platba byla zamítnuta. Přihlaste se na http://banka-overeni.cz k odblokování.',
      false,
      'cs',
      activeRollback,
      settings
    );
    expect(['HIGH_RISK', 'VERIFICATION_RECOMMENDED']).toContain(resultRollback.riskLevel);

    // Record trace for rolled back execution
    const traceIdRollback = randomUUID();
    await traceRepo.record({
      id: traceIdRollback,
      provider: 'Compatible Mock Gateway',
      model: modelName,
      promptVersion: activeRollback.version,
      status: 'SUCCESS',
      failureReason: null,
      durationMs: 110,
      inputTokens: 130,
      outputTokens: 80,
      rejectedEvidence: 0,
      estimatedCostUsd: 0.00112,
    });

    const recordedTraceRollback = await pool.query('SELECT prompt_version FROM ai_traces WHERE id=$1', [traceIdRollback]);
    expect(recordedTraceRollback.rows[0].prompt_version).toBe(idA);
  });
});
