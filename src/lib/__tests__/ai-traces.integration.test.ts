// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { TraceRepository } from '@/ai/traces/repository';
const connectionString = process.env.SITE_CONFIG_TEST_DATABASE_URL;
describe.skipIf(!connectionString)('privacy-bounded AI traces', () => {
  const schema = `trace_test_${randomUUID().replaceAll('-', '')}`;
  const control = new Pool({ connectionString });
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
  const repository = new TraceRepository(pool);
  beforeAll(async () => { await control.query(`CREATE SCHEMA ${schema}`); await pool.query(await readFile('migrations/008_ai_traces.sql', 'utf8')); await pool.query(await readFile('migrations/015_provider_identity.sql','utf8')); });
  afterAll(async () => { await pool.end(); await control.query(`DROP SCHEMA ${schema} CASCADE`); await control.end(); });
  it('keeps missing cost and tokens unknown and records only defined metadata', async () => {
    await repository.record({ id: randomUUID(), provider: 'Compatible API', model: 'synthetic-model', promptVersion: 'semantic-v1', status: 'FAILED', failureReason: 'timeout', durationMs: 45, inputTokens: null, outputTokens: null, rejectedEvidence: null, estimatedCostUsd: null });
    const [trace] = await repository.recent();
    expect(trace.estimated_cost_usd).toBeNull();
    expect(trace.input_tokens).toBeNull();
    for (const forbidden of ['text','prompt','key','ip']) expect(Object.keys(trace)).not.toContain(forbidden);
    const summary = await repository.summary();
    expect(summary).toMatchObject({ requests: 1, successes: 0, failures: 1, token_reports: 0 });
    expect(summary.input_tokens).toBeNull();
  });
  it('summarizes measured tokens without inventing a price', async () => {
    await repository.record({ id: randomUUID(), provider: 'Compatible API', model: 'synthetic-model', promptVersion: 'semantic-v1', status: 'SUCCESS', failureReason: null, durationMs: 100, inputTokens: 50, outputTokens: 20, rejectedEvidence: 0, estimatedCostUsd: null });
    expect(await repository.summary()).toMatchObject({ requests: 2, successes: 1, token_reports: 1, input_tokens: '50', output_tokens: '20' });
  });
});
