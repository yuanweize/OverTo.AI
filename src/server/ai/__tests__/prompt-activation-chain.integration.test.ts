// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { type AddressInfo } from 'node:net';
import { PromptRepository } from '@/ai/prompts/repository';
import { ProviderRepository } from '@/ai/providers/repository';
import { TraceRepository } from '@/ai/traces/repository';
import { AiBudgetGuard } from '@/server/ai/budgets';
import { analyzeSuspiciousMessage } from '@/lib/decision-engine';
import { runLlmAnalysisIfConfigured } from '@/lib/llm-adapter';

const testDbUrl =
  process.env.TEST_DATABASE_URL ||
  process.env.SITE_CONFIG_TEST_DATABASE_URL ||
  process.env.DATABASE_URL;

describe.skipIf(!testDbUrl)('runtime prompt activation, testing, execution, traces, and rollback with real mock server', () => {
  const schema = `prompt_runtime_${randomUUID().replaceAll('-', '')}`;
  let control: Pool;
  let pool: Pool;
  let promptRepo: PromptRepository;
  let providerRepo: ProviderRepository;
  let traceRepo: TraceRepository;
  let budgetGuard: AiBudgetGuard;

  interface MockRequest {
    url: string;
    headers: http.IncomingHttpHeaders;
    body: {
      messages: Array<{ role: string; content: string }>;
      [key: string]: unknown;
    };
  }

  let mockServer: http.Server;
  let mockServerBaseUrl: string;
  const receivedRequests: MockRequest[] = [];

  const rootId = 'root-runtime-user';
  const modelName = 'gpt-6.1-mock';

  beforeAll(async () => {
    // 1. Start deterministic local OpenAI-compatible mock server
    mockServer = http.createServer((req, res) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        let parsedBody: MockRequest['body'] = { messages: [] };
        try { parsedBody = { messages: [], ...JSON.parse(data) }; } catch {}
        receivedRequests.push({ url: req.url || '', headers: req.headers, body: parsedBody });

        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
          const userContent = parsedBody.messages?.find(m => m.role === 'user')?.content || '';
          const quote = userContent.includes('Pošli mi ihned 20 000 Kč') ? 'Pošli mi ihned 20 000 Kč' : null;

          const responseContent = JSON.stringify({
            claimedIdentity: null,
            requestedActions: [],
            riskSignals: quote ? [
              {
                category: 'PAYMENT_DEMAND',
                severity: 'HIGH',
                evidenceText: quote,
                explanation: 'Možný požadavek na platbu',
              },
            ] : [],
            missingInformation: ['Totožnost neověřena'],
            contextualSummary: 'Možný pokus o podvod',
            uncertainty: ['AI analýza nenahrazuje vyšetřování'],
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: `chatcmpl-${randomUUID()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: responseContent },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 145, completion_tokens: 55, total_tokens: 200 },
          }));
          return;
        }

        res.writeHead(404);
        res.end();
      });
    });

    await new Promise<void>(resolve => {
      mockServer.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = mockServer.address() as AddressInfo;
    mockServerBaseUrl = `http://127.0.0.1:${addr.port}/v1`;

    // Configure test environment variables for local testing
    Object.assign(process.env, { NODE_ENV: 'test' });
    process.env.AI_LOCAL_ONLY = 'true';
    process.env.AI_ENABLED = 'true';
    process.env.OPENAI_API_KEY = 'mock-key-for-test';
    process.env.OPENAI_BASE_URL = mockServerBaseUrl;
    process.env.AI_ALLOWED_BASE_URLS = mockServerBaseUrl;

    // 2. Initialize database schema
    control = new Pool({ connectionString: testDbUrl });
    await control.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString: testDbUrl, options: `-c search_path=${schema}` });
    promptRepo = new PromptRepository(pool);
    providerRepo = new ProviderRepository(pool);
    traceRepo = new TraceRepository(pool);
    budgetGuard = new AiBudgetGuard(pool);

    await pool.query('CREATE TABLE "user" (id text PRIMARY KEY, "emailVerified" boolean DEFAULT true)');
    await pool.query('INSERT INTO "user" (id, "emailVerified") VALUES ($1, true)', [rootId]);
    await pool.query(await readFile('migrations/007_platform_settings.sql', 'utf8'));
    await pool.query(await readFile('migrations/008_ai_traces.sql', 'utf8'));
    await pool.query(await readFile('migrations/010_ai_prompts.sql', 'utf8'));
    await pool.query(await readFile('migrations/011_prompt_test_metrics.sql', 'utf8'));
    await pool.query(await readFile('migrations/013_ai_provider_settings.sql', 'utf8'));
    await pool.query(await readFile('migrations/016_ai_budget_reservations.sql', 'utf8'));
    await pool.query("INSERT INTO platform_admins (user_id, role) VALUES ($1, 'ROOT')", [rootId]);

    // Pre-configure model pricing
    await AiBudgetGuard.setModelPricing(pool, {
      model: modelName,
      inputPerMillionUsd: 2.50,
      outputPerMillionUsd: 10.00,
      maxRequestCostUsd: 0.10,
    });

    // Configure provider settings in DB
    await providerRepo.update(rootId, 0, {
      enabled: true,
      providerName: 'Deterministic Mock LLM',
      baseUrl: mockServerBaseUrl,
      model: modelName,
      allowedModels: [modelName],
      timeoutMs: 5000,
      maxCompletionTokens: 500,
    });
  });

  afterAll(async () => {
    if (mockServer) {
      await new Promise<void>(resolve => mockServer.close(() => resolve()));
    }
    if (pool) await pool.end().catch(() => {});
    if (control) {
      await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
      await control.end().catch(() => {});
    }
  });

  it('proves end-to-end prompt lifecycle: Create A -> Real Adapter Test -> Activate A -> Engine Execution with A -> Create B -> Activate B -> Engine Execution with B -> Rollback to A -> Verified Traces', async () => {
    const providerSettings = (await providerRepo.read()).config;

    // 1. Create Prompt Version A
    const idA = await promptRepo.create(rootId, {
      name: 'Prompt Version A',
      instructions: 'ALPHA_SYSTEM_INSTRUCTIONS: Focus on urgent financial transfers and family emergencies.',
    });
    expect(idA).toMatch(/^[0-9a-f-]{36}$/);

    // 2. Send actual model-format test request using the real runLlmAnalysisIfConfigured adapter
    const promptRecordA = await promptRepo.get(idA);
    const testResultA = await runLlmAnalysisIfConfigured(
      'Ahoj mami, mám nové číslo. Pošli mi ihned 20 000 Kč na účet.',
      { version: promptRecordA.version, instructions: promptRecordA.instructions },
      providerSettings
    );

    // 3. Mock Server actually received Prompt A in system message payload!
    expect(testResultA.status).toBe('SUCCESS');
    expect(receivedRequests.length).toBeGreaterThan(0);
    const lastRequestA = receivedRequests[receivedRequests.length - 1];
    expect(lastRequestA.body.messages[0]!.content).toBe('ALPHA_SYSTEM_INSTRUCTIONS: Focus on urgent financial transfers and family emergencies.');

    // 4. Record test metric and activate Prompt Version A (optimistic lock version 0 -> 1)
    await promptRepo.recordTest(rootId, idA, modelName, {
      status: 'SUCCESS',
      inputTokens: testResultA.inputTokens ?? 145,
      outputTokens: testResultA.outputTokens ?? 55,
    }, 120);

    await promptRepo.activate(rootId, idA, 0, modelName);
    const activePromptA = await promptRepo.active();
    expect(activePromptA.version).toBe(idA);
    expect(activePromptA.instructions).toContain('ALPHA_SYSTEM_INSTRUCTIONS');

    // 5. Call actual analysis engine with LLM enabled
    // Reserve budget atomically
    const resA = await budgetGuard.reserve({
      provider: providerSettings.providerName,
      model: modelName,
      maxInputTokens: 1000,
      maxOutputTokens: 500,
    });
    expect(resA.allowed).toBe(true);

    const engineResultA = await analyzeSuspiciousMessage(
      'Ahoj mami, mám nové číslo. Pošli mi ihned 20 000 Kč na účet.',
      true,
      'cs',
      activePromptA,
      providerSettings
    );

    // 6. Mock server confirms Prompt A was used in engine execution!
    expect(engineResultA.metadata.aiStatus).toBe('SUCCESS');
    expect(engineResultA.metadata.aiModel).toBe(modelName);
    const engineReqA = receivedRequests[receivedRequests.length - 1];
    expect(engineReqA.body.messages[0]!.content).toBe(activePromptA.instructions);

    // Settle budget and record trace in DB
    const { settledCost: costA } = await budgetGuard.settle(resA.reservationId!, {
      inputTokens: engineResultA.metadata.inputTokens,
      outputTokens: engineResultA.metadata.outputTokens,
    });
    const traceIdA = randomUUID();
    await traceRepo.record({
      id: traceIdA,
      provider: providerSettings.providerName,
      model: modelName,
      promptVersion: activePromptA.version,
      status: 'SUCCESS',
      failureReason: null,
      durationMs: 85,
      inputTokens: engineResultA.metadata.inputTokens ?? null,
      outputTokens: engineResultA.metadata.outputTokens ?? null,
      rejectedEvidence: null,
      estimatedCostUsd: costA,
    });

    const dbTraceA = await pool.query('SELECT prompt_version, model, status, estimated_cost_usd FROM ai_traces WHERE id=$1', [traceIdA]);
    expect(dbTraceA.rows[0].prompt_version).toBe(idA);
    expect(Number(dbTraceA.rows[0].estimated_cost_usd)).toBeGreaterThan(0);

    // 7. Create & Activate Prompt Version B
    const idB = await promptRepo.create(rootId, {
      name: 'Prompt Version B',
      instructions: 'BETA_SYSTEM_INSTRUCTIONS: Stricter heuristic rules on bank impersonation and phishing domains.',
    });

    const promptRecordB = await promptRepo.get(idB);
    const testResultB = await runLlmAnalysisIfConfigured(
      'Ahoj mami, mám nové číslo. Pošli mi ihned 20 000 Kč na účet.',
      { version: promptRecordB.version, instructions: promptRecordB.instructions },
      providerSettings
    );
    expect(testResultB.status).toBe('SUCCESS');
    const lastRequestB = receivedRequests[receivedRequests.length - 1];
    expect(lastRequestB.body.messages[0]!.content).toContain('BETA_SYSTEM_INSTRUCTIONS');

    await promptRepo.recordTest(rootId, idB, modelName, {
      status: 'SUCCESS',
      inputTokens: testResultB.inputTokens ?? 145,
      outputTokens: testResultB.outputTokens ?? 55,
    }, 110);

    // Activate B (version 1 -> 2)
    await promptRepo.activate(rootId, idB, 1, modelName);
    const activePromptB = await promptRepo.active();
    expect(activePromptB.version).toBe(idB);
    expect(activePromptB.instructions).toContain('BETA_SYSTEM_INSTRUCTIONS');

    // 8. Call analysis engine again and verify Mock Server receives Prompt B
    const resB = await budgetGuard.reserve({
      provider: providerSettings.providerName,
      model: modelName,
    });
    expect(resB.allowed).toBe(true);

    const engineResultB = await analyzeSuspiciousMessage(
      'Ahoj mami, mám nové číslo. Pošli mi ihned 20 000 Kč na účet.',
      true,
      'cs',
      activePromptB,
      providerSettings
    );
    expect(engineResultB.metadata.aiStatus).toBe('SUCCESS');
    const engineReqB = receivedRequests[receivedRequests.length - 1];
    expect(engineReqB.body.messages[0]!.content).toBe(activePromptB.instructions);

    const { settledCost: costB } = await budgetGuard.settle(resB.reservationId!, {
      inputTokens: engineResultB.metadata.inputTokens,
      outputTokens: engineResultB.metadata.outputTokens,
    });
    const traceIdB = randomUUID();
    await traceRepo.record({
      id: traceIdB,
      provider: providerSettings.providerName,
      model: modelName,
      promptVersion: activePromptB.version,
      status: 'SUCCESS',
      failureReason: null,
      durationMs: 90,
      inputTokens: engineResultB.metadata.inputTokens ?? null,
      outputTokens: engineResultB.metadata.outputTokens ?? null,
      rejectedEvidence: null,
      estimatedCostUsd: costB,
    });

    const dbTraceB = await pool.query('SELECT prompt_version FROM ai_traces WHERE id=$1', [traceIdB]);
    expect(dbTraceB.rows[0].prompt_version).toBe(idB);

    // 9. Rollback to Prompt Version A (activate A again, version 2 -> 3)
    await promptRepo.activate(rootId, idA, 2, modelName);
    const activePromptRolledBack = await promptRepo.active();
    expect(activePromptRolledBack.version).toBe(idA);
    expect(activePromptRolledBack.instructions).toContain('ALPHA_SYSTEM_INSTRUCTIONS');

    // 10. Execute fraud analysis once more -> Mock Server confirms payload is Prompt A again!
    const engineResultRollback = await analyzeSuspiciousMessage(
      'Ahoj mami, mám nové číslo. Pošli mi ihned 20 000 Kč na účet.',
      true,
      'cs',
      activePromptRolledBack,
      providerSettings
    );
    expect(engineResultRollback.metadata.aiStatus).toBe('SUCCESS');
    const engineReqRollback = receivedRequests[receivedRequests.length - 1];
    expect(engineReqRollback.body.messages[0]!.content).toBe(activePromptRolledBack.instructions);
    expect(engineReqRollback.body.messages[0]!.content).toContain('ALPHA_SYSTEM_INSTRUCTIONS');
  });
});
