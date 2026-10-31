import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';

loadEnvConfig(process.cwd(), true);
async function setSyntheticUserVerified(email: string, verified: boolean) {
  if (!/^a-\d+-\d+@example\.com$/.test(email)) throw new Error('Refusing to alter non-test user');
  const address = process.env.OVERTO_DEV_DATABASE_URL;
  if (!address) throw new Error('Local test database missing');
  const url = new URL(address);
  if (url.hostname !== '127.0.0.1' || url.port !== '55443' || url.pathname !== '/overto') throw new Error('Refusing non-local database');
  const pool = new Pool({ connectionString: address });
  try { const result = await pool.query('UPDATE "user" SET "emailVerified"=$1 WHERE email=$2', [verified, email]); if (result.rowCount !== 1) throw new Error('Test user missing'); }
  finally { await pool.end(); }
}
async function expireSyntheticKey(email: string, key: string) {
  if (!/^a-\d+-\d+@example\.com$/.test(email) || !/^ovt_test_[A-Za-z0-9_-]{43}$/.test(key)) throw new Error('Refusing non-test key');
  const address = process.env.OVERTO_DEV_DATABASE_URL; if (!address) throw new Error('Local test database missing');
  const url = new URL(address); if (url.hostname !== '127.0.0.1' || url.port !== '55443' || url.pathname !== '/overto') throw new Error('Refusing non-local database');
  const pool = new Pool({ connectionString: address });
  try {
    const hash = createHash('sha256').update(key).digest('hex');
    const result = await pool.query('UPDATE local_api_keys k SET expires_at=now()-interval \'1 second\' FROM local_workspaces w JOIN "user" u ON u.id=w.user_id WHERE k.workspace_id=w.id AND u.email=$1 AND k.key_hash=$2', [email, hash]);
    if (result.rowCount !== 1) throw new Error('Test key missing');
  } finally { await pool.end(); }
}

async function localMailLink(email: string, subject: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const inbox = await (await fetch('http://127.0.0.1:8025/api/v1/messages?limit=200')).json();
    const message = inbox.messages.find((m: { To: { Address: string }[]; Subject: string }) => m.Subject === subject && m.To.some(recipient => recipient.Address === email));
    if (message) {
      const content = await (await fetch(`http://127.0.0.1:8025/api/v1/message/${message.ID}`)).json();
      const link = String(content.Text).match(/http:\/\/127\.0\.0\.1:3005\/[^\s]+/)?.[0];
      if (link) return link;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Local test email not received');
}

async function verifiedSignup(page: Page, name: string, email: string, password: string) {
  await page.goto('/signup'); await page.getByLabel('Jméno').fill(name); await page.getByLabel('E-mail').fill(email); await page.getByLabel(/Heslo/).fill(password); await page.getByRole('button', { name: 'Vytvořit účet' }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await page.goto('/dashboard'); await expect(page).toHaveURL(/\/login/);
  await page.goto(await localMailLink(email, 'Ověření e-mailu — místní test'));
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('E-mail').fill(email); await page.getByLabel('Heslo').fill(password); await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await expect(page.getByRole('heading', { name: `Vítejte, ${name}.` })).toBeVisible();
}

async function captureDarkMobile(page: Page, path: string) {
  const desktop = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  const height = await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); return document.documentElement.scrollHeight; });
  await page.setViewportSize({ width: 390, height: Math.min(height, 5000) });
  await page.screenshot({ path, animations: 'disabled' });
  await page.emulateMedia({ colorScheme: 'light' });
  if (desktop) await page.setViewportSize(desktop);
}

test('local registration, workspace, project, logout and isolation', async ({ browser }) => {
  const one = await browser.newContext({ locale: 'cs-CZ', viewport: { width: 1440, height: 900 } }); const two = await browser.newContext({ locale: 'cs-CZ' });
  const a = await one.newPage(); const b = await two.newPage();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const password = 'unique-local-test-password-42';
  const aEmail = `a-${suffix}@example.com`;
  await verifiedSignup(a, 'Test A', aEmail, password);
  await expect(a.getByRole('heading', { name: 'Testovací kredity' })).toBeVisible(); await expect(a.getByText('10', { exact: true })).toBeVisible();
  if (process.env.OVERTO_CAPTURE_UI === 'true') { await a.screenshot({ path: 'assets/screenshots/v7-dashboard-cs-1440.png', fullPage: true }); await captureDarkMobile(a, 'assets/screenshots/v7-dashboard-cs-dark-390.png'); }
  if (process.env.OVERTO_CAPTURE_UI === 'true') {
    await a.goto('/dashboard/billing');
    await expect(a.getByRole('heading', { name: 'Fakturace', exact: true })).toBeVisible();
    await a.screenshot({ path: 'assets/screenshots/v7-billing-cs-1440.png', fullPage: true });
    await captureDarkMobile(a, 'assets/screenshots/v7-billing-cs-dark-390.png');
  }
  await a.goto('/dashboard/analyze');
  await a.getByLabel('Vložte podezřelou zprávu').fill('Ahoj mami, mám nové číslo. Pošli mi ihned peníze.');
  await a.getByRole('button', { name: 'Pokračovat ke kontrole textu' }).click();
  await a.getByLabel(/Zkontroloval.a jsem text/).check();
  await a.getByRole('button', { name: 'Odeslat a analyzovat pravidly' }).click();
  await expect(a.getByText('Odečteno testovacích kreditů: 1')).toBeVisible();
  await a.goto('/dashboard'); await expect(a.getByText('9', { exact: true })).toBeVisible();
  await a.goto('/dashboard/usage'); await expect(a.getByText(/Pravidla · NOT_REQUESTED · 1/)).toBeVisible();
  const noConsent = await a.request.post('/api/local/analyses', { headers: { Origin: 'http://127.0.0.1:3005', 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test', enableLlm: true } });
  expect(noConsent.status()).toBe(400);
  const crossOrigin = await a.request.post('/api/local/analyses', { headers: { Origin: 'https://example.com', 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test', enableLlm: false } });
  expect(crossOrigin.status()).toBe(403);
  const repeat = await a.evaluate(async () => {
    const key = crypto.randomUUID();
    const request = () => fetch('/api/local/analyses', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ text: 'Test zpráva', enableLlm: false }) });
    const first = await request(); const second = await request(); return [first.status, second.status];
  });
  expect(repeat).toEqual([200, 409]);
  await a.goto('/dashboard/api-keys');
  const aProjectId = await a.getByRole('combobox', { name: /^Projekt/ }).inputValue();
  await a.getByLabel('Název klíče').fill('Testovací klíč'); await a.getByRole('button', { name: 'Vytvořit klíč' }).click();
  let apiKey = await a.getByLabel('Nový API klíč').inputValue();
  const apiResult = await a.request.post('/api/v1/analyses', { headers: { Authorization: `Bearer ${apiKey}`, 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test zpráva', enableLlm: false } });
  expect(apiResult.status()).toBe(200); expect((await apiResult.json()).metadata.testCreditsCharged).toBe(1);
  const deniedAi = await a.request.post('/api/v1/analyses', { headers: { Authorization: `Bearer ${apiKey}`, 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test zpráva', enableLlm: true, aiConsent: true } });
  expect(deniedAi.status()).toBe(403);
  await a.reload();
  await expect(a.locator('li').filter({ hasText: apiKey.slice(0, 15) }).getByLabel('Dnes využito 2 z 1000 požadavků')).toBeVisible();
  a.once('dialog', dialog => dialog.accept());
  await a.getByRole('button', { name: 'Vyměnit klíč' }).click();
  const replacement = await a.getByLabel('Nový API klíč').inputValue();
  expect(replacement).not.toBe(apiKey);
  await a.reload();
  await expect(a.locator('li').filter({ hasText: replacement.slice(0, 15) }).getByLabel('Dnes využito 2 z 1000 požadavků')).toBeVisible();
  const oldKeyDenied = await a.request.post('/api/v1/analyses', { headers: { Authorization: `Bearer ${apiKey}`, 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test zpráva', enableLlm: false } });
  expect(oldKeyDenied.status()).toBe(401);
  apiKey = replacement;
  await setSyntheticUserVerified(aEmail, false);
  try {
    const unverified = await a.request.post('/api/v1/analyses', { headers: { Authorization: `Bearer ${apiKey}`, 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test zpráva', enableLlm: false } });
    expect(unverified.status()).toBe(401);
    const profileChange = await a.request.post('/api/auth/update-user', { headers: { Origin: 'http://127.0.0.1:3005' }, data: { name: 'Unauthorized' } });
    expect(profileChange.status()).toBe(401);
    await a.goto('/dashboard'); await expect(a).toHaveURL(/\/login/);
  } finally { await setSyntheticUserVerified(aEmail, true); }
  await a.goto('/dashboard/playground'); await a.getByLabel(/Testovací API klíč/).fill(apiKey); await a.getByRole('button', { name: 'Odeslat test' }).click();
  await expect(a.getByRole('status')).toContainText('HTTP 200'); await expect(a.locator('main pre')).toContainText('testCreditsCharged');
  await a.getByLabel(/Testovací API klíč/).fill('');
  if (process.env.OVERTO_CAPTURE_UI === 'true') await a.screenshot({ path: 'assets/screenshots/v7-playground-cs-1440.png', fullPage: true });
  await a.goto('/dashboard/api-keys');
  await expect(a.getByLabel('Nový API klíč')).toHaveCount(0);
  const activeKeyRow = a.locator('li').filter({ hasText: apiKey.slice(0, 15) });
  await expect(activeKeyRow.getByLabel('Dnes využito 3 z 1000 požadavků')).toBeVisible();
  if (process.env.OVERTO_CAPTURE_UI === 'true') { await a.screenshot({ path: 'assets/screenshots/v7-api-keys-cs-1440.png', fullPage: true }); await captureDarkMobile(a, 'assets/screenshots/v7-api-keys-cs-dark-390.png'); }
  await activeKeyRow.getByRole('button', { name: 'Zrušit klíč' }).click();
  await expect(activeKeyRow).toContainText('Zrušen');
  const revoked = await a.request.post('/api/v1/analyses', { headers: { Authorization: `Bearer ${apiKey}`, 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test zpráva', enableLlm: false } });
  expect(revoked.status()).toBe(401);
  const concurrent = await a.evaluate(async () => Promise.all(Array.from({ length: 20 }, async () => {
    const response = await fetch('/api/local/analyses', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ text: 'Test zpráva', enableLlm: false }) });
    return response.status;
  })));
  expect(concurrent.filter(status => status === 200)).toHaveLength(6);
  expect(concurrent.filter(status => status === 402)).toHaveLength(14);
  await a.goto('/dashboard'); await expect(a.getByRole('main').getByText('0', { exact: true })).toBeVisible();
  await a.getByRole('link', { name: 'Projekty', exact: true }).click();
  const defaultRow = a.locator(`li[data-project-id="${aProjectId}"]`);
  await defaultRow.getByRole('button', { name: 'Přejmenovat' }).click();
  await defaultRow.getByLabel('Nový název').fill('Můj výchozí projekt'); await defaultRow.getByRole('button', { name: 'Uložit název' }).click();
  await expect(defaultRow.getByText('Můj výchozí projekt')).toBeVisible(); await a.goto('/dashboard'); await expect(a.getByRole('heading', { name: 'Projekty' })).toBeVisible(); await a.goto('/dashboard/projects');
  const defaultArchive = await a.request.patch(`/api/local/projects/${aProjectId}`, { headers: { Origin: 'http://127.0.0.1:3005' }, data: { archived: true } }); expect(defaultArchive.status()).toBe(409);
  await a.getByLabel('Název nového projektu').fill('Výchozí projekt'); await a.getByRole('button', { name: 'Vytvořit projekt' }).click();
  await expect(a.getByLabel('Název nového projektu')).toHaveValue('');
  await a.goto('/dashboard'); await expect(a.getByRole('heading', { name: 'Projekty' })).toBeVisible(); await a.goto('/dashboard/projects');
  await a.getByLabel('Název nového projektu').fill('Projekt pouze A'); await a.getByRole('button', { name: 'Vytvořit projekt' }).click(); await expect(a.getByText('Projekt pouze A')).toBeVisible();
  const projectRow = a.locator('li[data-project-id]').filter({ hasText: 'Projekt pouze A' });
  const privateProjectId = await projectRow.getAttribute('data-project-id'); expect(privateProjectId).toBeTruthy();
  await projectRow.getByRole('button', { name: 'Přejmenovat' }).click();
  await projectRow.getByLabel('Nový název').fill('Přejmenovaný projekt A'); await projectRow.getByRole('button', { name: 'Uložit název' }).click();
  const renamedRow = a.locator(`li[data-project-id="${privateProjectId}"]`); await expect(renamedRow.getByText('Přejmenovaný projekt A')).toBeVisible();
  const projectKeyResponse = await a.request.post('/api/local/api-keys', { headers: { Origin: 'http://127.0.0.1:3005' }, data: { name: 'Project key', projectId: privateProjectId } });
  expect(projectKeyResponse.status()).toBe(201); const projectKey = (await projectKeyResponse.json()).key;
  await renamedRow.getByRole('button', { name: 'Archivovat' }).click(); await expect(renamedRow.getByText('Archivován')).toBeVisible();
  const archivedKeyCreate = await a.request.post('/api/local/api-keys', { headers: { Origin: 'http://127.0.0.1:3005' }, data: { name: 'forbidden', projectId: privateProjectId } }); expect(archivedKeyCreate.status()).toBe(404);
  const archivedRequest = await a.request.post('/api/v1/analyses', { headers: { Authorization: `Bearer ${projectKey}`, 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test zpráva', enableLlm: false } });
  expect(archivedRequest.status()).toBe(401);
  await verifiedSignup(b, 'Test B', `b-${suffix}@example.com`, password); await b.getByRole('link', { name: 'Projekty', exact: true }).click(); await expect(b.getByText('Projekt pouze A')).toHaveCount(0);
  const crossProject = await b.request.post('/api/local/api-keys', { headers: { Origin: 'http://127.0.0.1:3005' }, data: { name: 'forbidden', projectId: aProjectId } });
  expect(crossProject.status()).toBe(404);
  const crossEdit = await b.request.patch(`/api/local/projects/${privateProjectId}`, { headers: { Origin: 'http://127.0.0.1:3005' }, data: { name: 'Unauthorized' } });
  expect(crossEdit.status()).toBe(404);
  const crossAnalysis = await b.request.post('/api/local/analyses', { headers: { Origin: 'http://127.0.0.1:3005', 'X-Project-Id': privateProjectId!, 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test zpráva', enableLlm: false } });
  expect(crossAnalysis.status()).toBe(404);
  await renamedRow.getByRole('button', { name: 'Obnovit' }).click(); await expect(renamedRow.getByText('Aktivní projekt')).toBeVisible();
  if (process.env.OVERTO_CAPTURE_UI === 'true') await a.screenshot({ path: 'assets/screenshots/saas-projects.png', fullPage: true });
  const restoredRequest = await a.request.post('/api/v1/analyses', { headers: { Authorization: `Bearer ${projectKey}`, 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test zpráva', enableLlm: false } });
  expect(restoredRequest.status()).toBe(402);
  await expireSyntheticKey(aEmail, projectKey);
  const expired = await a.request.post('/api/v1/analyses', { headers: { Authorization: `Bearer ${projectKey}`, 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test zpráva', enableLlm: false } });
  expect(expired.status()).toBe(401);
  await a.getByLabel('Jazyk', { exact: true }).selectOption('en');
  await expect(a.locator('html')).toHaveAttribute('lang','en');
  for (const [route,title] of [['projects','Projects'],['api-keys','API keys'],['usage','Usage'],['settings','Settings'],['billing','Billing']]) {
    await a.goto(`/dashboard/${route}`); await expect(a.getByRole('heading',{name:title,exact:true})).toBeVisible();
    if (process.env.OVERTO_A11Y_ACCOUNT === 'true') {
      const scan = await new AxeBuilder({ page: a }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
      expect(scan.violations.map(v => ({ rule: v.id, targets: v.nodes.map(n => n.target) })), `dashboard/${route}`).toEqual([]);
    }
  }
  await a.goto('/dashboard/projects');
  await expect(a.getByRole('heading',{name:'Projects',exact:true})).toBeVisible();
  if (process.env.OVERTO_CAPTURE_UI === 'true') await a.screenshot({path:'assets/screenshots/v7-workspace-en.png',fullPage:true});
  await a.setViewportSize({width:390,height:844}); await a.emulateMedia({colorScheme:'dark'});
  await a.locator('.workspace-mobile-nav summary').click();
  await expect(a.getByRole('link',{name:'Projects',exact:true})).toHaveAttribute('aria-current','page');
  expect(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await a.locator('.workspace-mobile-nav summary').click();
  if (process.env.OVERTO_CAPTURE_UI === 'true') await a.screenshot({path:'assets/screenshots/v7-workspace-mobile.png',fullPage:true});
  await a.getByLabel('Language',{exact:true}).selectOption('cs'); await expect(a.locator('html')).toHaveAttribute('lang','cs');
  await a.setViewportSize({width:1280,height:900});
  await a.getByRole('button', { name: 'Odhlásit se' }).click(); await expect(a).toHaveURL(/\/login/); await a.goto('/dashboard'); await expect(a).toHaveURL(/\/login/);
  await one.close(); await two.close();
});

test('developer playground sends real rules request', async ({ page }) => {
  await page.goto('/developers'); await page.getByRole('button', { name: 'Odeslat test' }).click();
  await expect(page.getByRole('status')).toContainText('HTTP 200'); await expect(page.locator('pre').last()).toContainText('schemaVersion');
});

test('web analysis records usage against the selected project', async ({ page }) => {
  const email = `select-${Date.now()}-${Math.floor(Math.random() * 1000000)}@example.com`;
  await verifiedSignup(page, 'Project Test', email, 'project-test-password-42');
  await page.goto('/dashboard/projects'); await page.getByLabel('Název nového projektu').fill('Vybraný projekt'); await page.getByRole('button', { name: 'Vytvořit projekt' }).click();
  await expect(page.getByText('Vybraný projekt')).toBeVisible();
  await page.goto('/dashboard/analyze'); await page.getByLabel('Projekt pro analýzu').selectOption({ label: 'Vybraný projekt' });
  await page.getByLabel('Vložte podezřelou zprávu').fill('Ahoj mami, mám nové číslo. Pošli mi ihned peníze.');
  if (process.env.OVERTO_CAPTURE_UI === 'true') await page.screenshot({ path: 'assets/screenshots/saas-project-analysis.png', fullPage: true });
  await page.getByRole('button', { name: 'Pokračovat ke kontrole textu' }).click(); await page.getByLabel(/Zkontroloval.a jsem text/).check();
  await page.getByRole('button', { name: 'Odeslat a analyzovat pravidly' }).click(); await expect(page.getByText('Odečteno testovacích kreditů: 1')).toBeVisible();
  await page.goto('/dashboard/usage'); await expect(page.getByText(/Pravidla · NOT_REQUESTED · 1.*Vybraný projekt/)).toBeVisible();
  await page.goto('/dashboard/billing'); await expect(page.getByRole('button', { name: 'Otevřít testovací platbu' })).toBeDisabled();
  if (process.env.OVERTO_CAPTURE_UI === 'true') await page.screenshot({ path: 'assets/screenshots/saas-billing-test.png', fullPage: true });
  const disabledCheckout = await page.request.post('/api/local/stripe/checkout', { headers: { Origin: 'http://127.0.0.1:3005', 'Idempotency-Key': crypto.randomUUID() } }); expect(disabledCheckout.status()).toBe(503);
  const disabledWebhook = await page.request.post('/api/local/stripe/webhook', { data: '{}' }); expect(disabledWebhook.status()).toBe(503);
  await page.goto('/dashboard/settings'); await page.getByLabel('Jméno').fill('Nové jméno'); await page.getByRole('button', { name: 'Uložit profil' }).click();
  await expect(page.getByRole('status')).toContainText('Profil je uložen.'); await page.goto('/dashboard'); await expect(page.getByRole('heading', { name: 'Vítejte, Nové jméno.' })).toBeVisible();

  // Real browser account export and deletion test
  await page.goto('/dashboard/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportovat data účtu' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^overto-account-export-.*\.json$/);

  // Attempt account deletion with incorrect password
  await page.getByPlaceholder(email).fill(email);
  await page.getByPlaceholder('••••••••••••').fill('wrong-password-999');
  await page.getByRole('button', { name: 'Trvale smazat účet' }).click();
  await expect(page.getByRole('alert')).toContainText('Zadané heslo pro potvrzení smazání účtu není správné.');

  // Delete account with correct password
  await page.getByPlaceholder('••••••••••••').fill('project-test-password-42');
  await page.getByRole('button', { name: 'Trvale smazat účet' }).click();
  await expect(page).toHaveURL(/\/login/);

  // Verify deleted user cannot log in
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Heslo').fill('project-test-password-42');
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('password reset invalidates existing session and old password', async ({ browser }) => {
  const first = await browser.newContext({ locale: 'cs-CZ' }); const second = await browser.newContext({ locale: 'cs-CZ' });
  const page = await first.newPage(); const other = await second.newPage();
  const email = `reset-${Date.now()}-${Math.floor(Math.random() * 1000000)}@example.com`;
  const oldPassword = 'old-test-password-42'; const newPassword = 'new-test-password-57';
  await verifiedSignup(page, 'Reset Test', email, oldPassword);
  await other.goto('/login'); await other.getByLabel('E-mail').fill(email); await other.getByLabel('Heslo').fill(oldPassword); await other.getByRole('button', { name: 'Přihlásit se' }).click(); await expect(other).toHaveURL(/\/dashboard/);
  await page.goto('/forgot-password'); await page.getByLabel('E-mail').fill(email); await page.getByRole('button', { name: 'Odeslat odkaz' }).click();
  await expect(page.getByRole('status')).toContainText('Pokud účet existuje');
  const resetLink = await localMailLink(email, 'Obnovení hesla — místní test');
  await page.goto(resetLink);
  await expect(page).toHaveURL(/\/reset-password/); await page.getByLabel('Nové heslo').fill(newPassword); await page.getByRole('button', { name: 'Nastavit nové heslo' }).click();
  await expect(page.getByRole('status')).toContainText('Heslo bylo změněno');
  await page.goto(resetLink); await expect(page.getByText('Odkaz je neplatný nebo vypršel.')).toBeVisible();
  await other.goto('/dashboard'); await expect(other).toHaveURL(/\/login/);
  await other.getByLabel('E-mail').fill(email); await other.getByLabel('Heslo').fill(oldPassword); await other.getByRole('button', { name: 'Přihlásit se' }).click(); await expect(other.getByRole('alert')).toBeVisible();
  await other.getByLabel('Heslo').fill(newPassword); await other.getByRole('button', { name: 'Přihlásit se' }).click(); await expect(other).toHaveURL(/\/dashboard/);
  await first.close(); await second.close();
});

test('public pages fit common viewport widths', async ({ page }) => {
  for (const width of [375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/analyze', '/pricing', '/developers', '/login', '/signup', '/verify-email', '/forgot-password', '/reset-password']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${path} at ${width}px`).toBe(false);
    }
  }
});

test('system dark theme keeps the main surfaces readable on mobile', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/analyze', '/developers', '/pricing']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('header')).toHaveCSS('background-color', 'rgb(23, 37, 54)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), path).toBe(false);
  }
  await page.goto('/analyze');
  await expect(page.locator('#top')).toHaveCSS('background-color', 'rgb(16, 26, 38)');
  await expect(page.locator('#message-input')).toHaveCSS('background-color', 'rgb(16, 26, 38)');
});
