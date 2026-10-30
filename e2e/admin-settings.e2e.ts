import { test, expect } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
loadEnvConfig(process.cwd(), true);

// Run explicitly with one worker: this journey temporarily changes global site settings.
test('root can inspect operations, save branding and restore the prior version', async ({ page, browser }) => {
  test.skip(process.env.OVERTO_ADMIN_E2E !== 'true', 'Explicit local administrator acceptance run only');
  test.setTimeout(150000);
  const connectionString = process.env.OVERTO_DEV_DATABASE_URL!;
  const address = new URL(connectionString);
  if (address.hostname !== '127.0.0.1' || address.port !== '55443' || address.pathname !== '/overto') throw new Error('Dedicated local database required');
  const pool = new Pool({ connectionString });
  let id: string | undefined;
  let original: { version: number; config: Record<string, unknown> } | undefined;
  const origin = 'http://127.0.0.1:3005';
  try {
    const anonymous = await browser.newContext();
    try {
      for (const path of ['/admin/operations', '/admin/users', '/admin/billing', '/admin/audit', '/admin/system']) {
        expect((await anonymous.request.get(`${origin}${path}`)).status(), `${path} must not expose operations`).toBe(404);
      }
    } finally { await anonymous.close(); }
    if ((await pool.query('SELECT 1 FROM platform_admins')).rowCount) { test.skip(true, 'An operator already owns root; no role changes allowed'); return; }
    const email = `admin-acceptance-${randomUUID()}@example.com`;
    const password = `test-${randomUUID()}`;
    const signup = await page.request.post('/api/auth/sign-up/email', { headers: { Origin: origin }, data: { name: 'Synthetic administrator', email, password } });
    expect(signup.status()).toBe(200);
    const user = await pool.query('UPDATE "user" SET "emailVerified"=true WHERE email=$1 RETURNING id', [email]);
    id = user.rows[0].id;
    await pool.query("INSERT INTO platform_admins(user_id,role) VALUES ($1,'ROOT')", [id]);
    const login = await page.request.post('/api/auth/sign-in/email', { headers: { Origin: origin }, data: { email, password } });
    expect(login.status()).toBe(200);
    if (process.env.OVERTO_CAPTURE_UI === 'true' || process.env.OVERTO_ADMIN_VISUAL_ONLY === 'true') await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/operations');
    await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible();
    await expect(page.getByText('Analyses today')).toBeVisible();
    if (process.env.OVERTO_CAPTURE_UI === 'true' || process.env.OVERTO_ADMIN_VISUAL_ONLY === 'true') {
      await page.screenshot({ path: 'assets/screenshots/v7-admin-overview-en-1440.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: 'assets/screenshots/v7-admin-overview-en-dark-390.png', fullPage: true });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('combobox', { name: 'Language' }).selectOption('cs');
      await expect(page.getByRole('heading', { name: 'Přehled provozu' })).toBeVisible();
      await page.screenshot({ path: 'assets/screenshots/v7-admin-overview-cs-1440.png', fullPage: true });
      await page.getByRole('combobox', { name: 'Jazyk' }).selectOption('en');
      await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible();
    }
    await page.goto('/admin/users?q=admin-acceptance-');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await expect(page.getByRole('main').getByText(email)).toBeVisible();
    if (process.env.OVERTO_CAPTURE_UI === 'true' || process.env.OVERTO_ADMIN_VISUAL_ONLY === 'true') await page.screenshot({ path: 'assets/screenshots/v7-admin-users-en-1440.png', fullPage: true });
    await page.goto('/admin/users?q=no-such-synthetic-user');
    await expect(page.getByText('No accounts match this search.')).toBeVisible();
    await page.goto('/admin/users?q=%25');
    await expect(page.getByText('No accounts match this search.')).toBeVisible();
    await page.goto('/admin/billing');
    await expect(page.getByRole('heading', { name: 'Billing activity' })).toBeVisible();
    await page.goto('/admin/audit');
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    await page.goto('/admin/system');
    await expect(page.getByRole('heading', { name: 'System status' })).toBeVisible();
    await expect(page.getByText('Database connection')).toBeVisible();
    if (process.env.OVERTO_ADMIN_VISUAL_ONLY === 'true') {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/admin/ai-studio');
      await expect(page.getByRole('heading', { name: 'AI Studio', exact: true })).toBeVisible();
      await page.emulateMedia({ colorScheme: 'light' });
      await page.screenshot({ path: 'assets/screenshots/v7-ai-studio-en-light.png', fullPage: true });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: 'assets/screenshots/v7-ai-studio-en-dark.png', fullPage: true });
      return;
    }
    original = await (await page.request.get('/api/site')).json();
    await page.goto('/admin');
    await page.getByLabel('Site name', { exact: true }).fill('Evidence test site');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Changes saved.');
    const saved = await (await page.request.get('/api/site')).json();
    expect(saved.version).toBe(original!.version + 1);
    expect(saved.config.siteName).toBe('Evidence test site');
    const stale = await page.request.put('/api/admin/site', { headers: { Origin: origin }, data: original });
    expect(stale.status()).toBe(409);
    if (process.env.OVERTO_CAPTURE_UI === 'true') await page.screenshot({ path: 'assets/screenshots/v6-admin-settings.png', fullPage: true });
    await page.goto('/admin/ai-studio');
    await expect(page.getByRole('heading', { name: 'AI Studio', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Latest 100 traces' })).toBeVisible();
    if (process.env.OVERTO_CAPTURE_UI === 'true') await page.screenshot({ path: 'assets/screenshots/v6-ai-traces.png', fullPage: true });
    await page.goto('/admin/ai-studio/providers');
    await expect(page.getByRole('heading',{name:'Model service configuration'})).toBeVisible();
    const providerOriginal=(await pool.query('SELECT version,config FROM ai_provider_settings WHERE id=1')).rows[0];
    const model=await page.getByLabel('Default model',{exact:true}).inputValue();
    const enabledBefore=await page.getByLabel('Enable model requests',{exact:true}).isChecked();
    try {
      await page.getByLabel('Enable model requests',{exact:true}).uncheck();
      await page.getByRole('button',{name:'Save configuration',exact:true}).click();
      await expect(page.getByRole('status')).toHaveText('Configuration saved.');
      const unavailable=await page.request.post('/api/analyze',{data:{text:'Synthetic configuration check',enableLlm:true,aiConsent:true}});
      expect((await unavailable.json()).metadata.aiStatus).toBe('UNAVAILABLE');
      const current=(await pool.query('SELECT version,config FROM ai_provider_settings WHERE id=1')).rows[0];
      const stale=await page.request.put('/api/admin/ai-studio/providers',{headers:{Origin:origin},data:{version:providerOriginal.version,config:current.config}});
      expect(stale.status()).toBe(409);
    } finally {
      const current=(await pool.query('SELECT version,config FROM ai_provider_settings WHERE id=1')).rows[0];
      const restored=await page.request.put('/api/admin/ai-studio/providers',{headers:{Origin:origin},data:{version:current.version,config:providerOriginal.config??{...current.config,enabled:enabledBefore,model}}});
      expect(restored.status()).toBe(200);
    }
    const modelOriginal=(await pool.query('SELECT version,config FROM ai_provider_settings WHERE id=1')).rows[0];
    try {
      await page.goto('/admin/ai-studio/models');
      await expect(page.getByRole('heading',{name:'Models in this workspace'})).toBeVisible();
      await page.getByLabel('Model ID').fill('synthetic-admin-model');
      await page.getByRole('button',{name:'Add model'}).click();
      await page.getByRole('radio',{name:/synthetic-admin-model/}).check();
      await page.getByRole('button',{name:'Save model registry'}).click();
      await expect(page.getByRole('status')).toHaveText('Model registry saved.');
      const persisted=(await pool.query('SELECT config FROM ai_provider_settings WHERE id=1')).rows[0].config;
      expect(persisted.model).toBe('synthetic-admin-model');
      expect(persisted.allowedModels).toContain('synthetic-admin-model');
      if (process.env.OVERTO_CAPTURE_UI === 'true') await page.screenshot({path:'assets/screenshots/v7-model-registry.png',fullPage:true});
    } finally {
      const current=(await pool.query('SELECT version FROM ai_provider_settings WHERE id=1')).rows[0];
      const restored=await page.request.put('/api/admin/ai-studio/providers',{headers:{Origin:origin},data:{version:current.version,config:modelOriginal.config}});
      expect(restored.status()).toBe(200);
    }
    await page.goto('/admin/ai-studio/prompts');
    await expect(page.getByRole('heading',{name:'Versions you can trace.'})).toBeVisible();
    await page.getByLabel('Version name',{exact:true}).fill('Synthetic acceptance version');
    await page.getByRole('button',{name:'Save new version',exact:true}).click();
    await expect(page.getByRole('status')).toContainText('id');
    const draft=JSON.parse(await page.getByRole('status').innerText());
    const activation=(await pool.query('SELECT version,prompt_id FROM ai_prompt_activation WHERE id=1')).rows[0];
    const untested=await page.request.post('/api/admin/ai-studio/prompts',{headers:{Origin:origin},data:{operation:'activate',id:draft.id,version:activation.version}});
    expect(untested.status()).toBe(400);
    expect((await untested.json()).error).toBe('SUCCESSFUL_TEST_REQUIRED');
    if (process.env.OVERTO_LIVE_PROMPT_E2E==='true') {
      // Real external calls, explicitly enabled. No private message content.
      await page.getByLabel(/I reviewed the test text/).check();
      await page.getByRole('button',{name:'Run real test',exact:true}).click();
      await expect(page.getByRole('status')).toContainText('traceId',{timeout:60000});
      const tested=JSON.parse(await page.getByRole('status').innerText());
      expect(tested.status).toBe('SUCCESS');
      const activated=await page.request.post('/api/admin/ai-studio/prompts',{headers:{Origin:origin},data:{operation:'activate',id:draft.id,version:activation.version}});
      expect(activated.status()).toBe(200);
      try {
        const result=await page.request.post('/api/analyze',{data:{text:'Ahoj mami, mám nové číslo. Pošli mi ihned peníze.',enableLlm:true,aiConsent:true}});
        const body=await result.json();expect(body.metadata.aiStatus).toBe('SUCCESS');expect(body.metadata.promptVersion).toBe(draft.id);expect(body.metadata.traceRecorded).toBe(true);
      } finally {
        const restored=await page.request.post('/api/admin/ai-studio/prompts',{headers:{Origin:origin},data:{operation:'activate',id:activation.prompt_id,version:activation.version+1}});
        expect(restored.status(),'Restore previously active prompt').toBe(200);
      }
    }
    if (process.env.OVERTO_CAPTURE_UI==='true') await page.screenshot({path:'assets/screenshots/v7-prompt-lab.png',fullPage:true});
    await page.goto('/admin/ai-studio/evaluations');
    await page.getByRole('button',{name:'Run evaluation',exact:true}).click();
    await expect(page.getByRole('status')).toHaveText('Results saved.');
    await expect(page.getByText(/RULES_ONLY · COMPLETED/).first()).toBeVisible();
    await page.goto('/admin/ai-studio/datasets');
    await expect(page.getByRole('heading',{name:'Synthetic dataset'})).toBeVisible();
    await page.goto('/');
    await expect(page.locator('header .brand-lockup')).toContainText('Evidence test site');
  } finally {
    if (original && id) {
      const current = await (await page.request.get('/api/site')).json();
      const restored = await page.request.put('/api/admin/site', { headers: { Origin: origin }, data: { version: current.version, config: original.config } });
      expect(restored.status(), 'Restore operator branding before removing test role').toBe(200);
    }
    if (id) await pool.query('DELETE FROM platform_admins WHERE user_id=$1', [id]);
    await pool.end();
  }
});
test.use({ locale: 'en-GB' });
