import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

// Explicit opt-in: this test changes global AI configuration in a disposable database.
test('production AI is budgeted, attributed, grounded and disabled for anonymous users', async ({ page }) => {
  test.skip(process.env.OVERTO_PRODUCTION_AI_E2E !== 'true', 'Isolated production AI Compose environment only');
  test.setTimeout(120000);
  const origin = 'http://127.0.0.1:3016';
  const env = readFileSync('.env.ai-qa', 'utf8');
  const connection = env.match(/^OVERTO_DATABASE_URL=(.+)$/m)?.[1];
  if (!connection || !connection.includes('@postgres:5432/overto')) throw new Error('Dedicated QA database required');
  const url = new URL(connection);
  url.hostname = '127.0.0.1'; url.port = '55447';
  const pool = new Pool({ connectionString: url.toString() });
  const email = `ai-qa-${randomUUID()}@example.com`;
  const password = `synthetic-${randomUUID()}`;
  let userId: string | undefined;
  try {
    const oldRoot = await pool.query('SELECT a.user_id,u.email FROM platform_admins a JOIN "user" u ON u.id=a.user_id WHERE a.role=$1', ['ROOT']);
    if (oldRoot.rowCount) {
      if (!String(oldRoot.rows[0].email).startsWith('ai-qa-')) throw new Error('Refusing to change an existing administrator');
      await pool.query('DELETE FROM platform_admins WHERE user_id=$1', [oldRoot.rows[0].user_id]);
    }
    const signup = await page.request.post(`${origin}/api/auth/sign-up/email`, { headers: { Origin: origin }, data: { name: 'AI QA', email, password } });
    expect(signup.status()).toBe(200);
    const user = await pool.query('UPDATE "user" SET "emailVerified"=true WHERE email=$1 RETURNING id', [email]);
    expect(user.rowCount).toBe(1);
    userId = user.rows[0].id;
    await pool.query("INSERT INTO platform_admins(user_id,role) VALUES ($1,'ROOT')", [user.rows[0].id]);
    const login = await page.request.post(`${origin}/api/auth/sign-in/email`, { headers: { Origin: origin }, data: { email, password } });
    expect(login.status()).toBe(200);

    const provider = await pool.query('SELECT version,config FROM ai_provider_settings WHERE id=1');
    const config = { ...provider.rows[0].config, enabled: true, providerName: 'Synthetic Mock Gateway', baseUrl: 'https://host.docker.internal:4443/v1', model: 'mock/production', allowedModels: ['mock/production'], timeoutMs: 5000, maxCompletionTokens: 200 };
    const providerSave = await page.request.put(`${origin}/api/admin/ai-studio/providers`, { headers: { Origin: origin }, data: { version: provider.rows[0].version, config } });
    expect(providerSave.status(), await providerSave.text()).toBe(200);
    for (const invalid of ['null', '[]']) {
      const rejected = await page.request.put(`${origin}/api/admin/ai-studio/pricing`, { headers: { Origin: origin, 'Content-Type': 'application/json' }, data: invalid });
      expect(rejected.status()).toBe(400);
      expect((await rejected.json()).error).toBe('INVALID_PRICING');
    }
    const pricing = await page.request.put(`${origin}/api/admin/ai-studio/pricing`, { headers: { Origin: origin }, data: { model: config.model, inputPerMillionUsd: 1, outputPerMillionUsd: 2, maxRequestCostUsd: 0.05, confirmCurrentProviderPricing: true } });
    expect(pricing.status(), await pricing.text()).toBe(200);
    const created = await page.request.post(`${origin}/api/admin/ai-studio/prompts`, { headers: { Origin: origin }, data: { operation: 'create', prompt: { name: 'Synthetic QA prompt', instructions: 'QA_SYSTEM_MARKER: Analyze suspicious messages and quote exact evidence from the text.' } } });
    expect(created.status(), await created.text()).toBe(201);
    const { id } = await created.json();
    const promptTest = await page.request.post(`${origin}/api/admin/ai-studio/prompts`, { headers: { Origin: origin }, data: { operation: 'test', id, consent: true, text: 'Pošli mi ihned peníze.' } });
    expect(promptTest.status(), await promptTest.text()).toBe(200);
    expect((await promptTest.json()).status).toBe('SUCCESS');
    const activation = await pool.query('SELECT version FROM ai_prompt_activation WHERE id=1');
    const activated = await page.request.post(`${origin}/api/admin/ai-studio/prompts`, { headers: { Origin: origin }, data: { operation: 'activate', id, version: activation.rows[0].version } });
    expect(activated.status(), await activated.text()).toBe(200);

    const analysis = await page.request.post(`${origin}/api/local/analyses`, { headers: { Origin: origin, 'Idempotency-Key': randomUUID() }, data: { text: 'Pošli mi ihned peníze.', enableLlm: true, aiConsent: true, locale: 'cs' } });
    expect(analysis.status(), await analysis.text()).toBe(200);
    const { result, creditsCharged } = await analysis.json();
    expect(creditsCharged).toBe(1);
    expect(result.metadata.aiStatus).toBe('SUCCESS');
    expect(result.metadata.promptVersion).toBe(id);
    expect(result.metadata.traceRecorded).toBe(true);
    expect(result.metadata.aiRequestDispatched).toBe(true);
    const reservation = await pool.query("SELECT status,workspace_id,project_id,settled_amount_usd FROM ai_budget_reservations WHERE model='mock/production' AND workspace_id IS NOT NULL ORDER BY created_at DESC LIMIT 1");
    expect(reservation.rows[0].status).toBe('SETTLED');
    expect(reservation.rows[0].workspace_id).toBeTruthy();
    expect(reservation.rows[0].project_id).toBeTruthy();
    expect(Number(reservation.rows[0].settled_amount_usd)).toBeGreaterThan(0);
    const trace = await pool.query('SELECT status,prompt_version FROM ai_traces WHERE id=$1', [result.metadata.traceId]);
    expect(trace.rows[0]).toMatchObject({ status: 'SUCCESS', prompt_version: id });

    await page.goto(`${origin}/dashboard/analyze`);
    await page.getByLabel('Vložte podezřelou zprávu').fill('Pošli mi ihned peníze.');
    await page.getByRole('button', { name: 'Pokračovat ke kontrole textu' }).click();
    await expect(page.getByLabel(/Chci použít AI/)).toBeVisible();
    await page.screenshot({ path: '/tmp/overto-ai-mock/ai-workspace-enabled.png', fullPage: true });
    await page.getByLabel(/Zkontroloval.a jsem text/).check();
    await page.getByLabel(/Chci použít AI/).check();
    await page.getByRole('button', { name: 'Odeslat a analyzovat s AI' }).click();
    await expect(page.getByText('Odečteno testovacích kreditů: 1')).toBeVisible();
    await page.screenshot({ path: '/tmp/overto-ai-mock/ai-workspace-result.png', fullPage: true });

    const beforeBlocked = await pool.query("SELECT count(*)::int AS n FROM ai_budget_reservations WHERE model='mock/production'");
    const expensive = await page.request.put(`${origin}/api/admin/ai-studio/pricing`, { headers: { Origin: origin }, data: { model: config.model, inputPerMillionUsd: 1000, outputPerMillionUsd: 1000, maxRequestCostUsd: 10, confirmCurrentProviderPricing: true } });
    expect(expensive.status()).toBe(200);
    const blocked = await page.request.post(`${origin}/api/local/analyses`, { headers: { Origin: origin, 'Idempotency-Key': randomUUID() }, data: { text: 'Pošli mi ihned peníze.', enableLlm: true, aiConsent: true } });
    expect(blocked.status()).toBe(200);
    const blockedBody = await blocked.json();
    expect(blockedBody.creditsCharged).toBe(0);
    expect(blockedBody.result.metadata.aiReason).toBe('max_request_budget_exceeded');
    const afterBlocked = await pool.query("SELECT count(*)::int AS n FROM ai_budget_reservations WHERE model='mock/production'");
    expect(afterBlocked.rows[0].n).toBe(beforeBlocked.rows[0].n);

    const current = await pool.query('SELECT version,config FROM ai_provider_settings WHERE id=1');
    const disable = await page.request.put(`${origin}/api/admin/ai-studio/providers`, { headers: { Origin: origin }, data: { version: current.rows[0].version, config: { ...current.rows[0].config, enabled: false } } });
    expect(disable.status()).toBe(200);
    const off = await page.request.post(`${origin}/api/local/analyses`, { headers: { Origin: origin, 'Idempotency-Key': randomUUID() }, data: { text: 'Pošli mi ihned peníze.', enableLlm: true, aiConsent: true } });
    expect(off.status()).toBe(200);
    expect((await off.json()).result.metadata.aiStatus).toBe('UNAVAILABLE');
    const rules = await page.request.post(`${origin}/api/local/analyses`, { headers: { Origin: origin, 'Idempotency-Key': randomUUID() }, data: { text: 'Pošli mi ihned peníze.', enableLlm: false } });
    expect(rules.status()).toBe(200);
    expect((await rules.json()).result.metadata.aiStatus).toBe('NOT_REQUESTED');

    const anonymous = await page.request.post(`${origin}/api/analyze`, { data: { text: 'Pošli mi ihned peníze.', enableLlm: true, aiConsent: true } });
    expect(anonymous.status()).toBe(200);
    expect((await anonymous.json()).metadata.aiReason).toBe('anonymous_disabled');
  } finally {
    if (userId) await pool.query('DELETE FROM platform_admins WHERE user_id=$1', [userId]);
    await pool.end();
  }
});
