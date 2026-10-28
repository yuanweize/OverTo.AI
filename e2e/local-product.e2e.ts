import { test, expect } from '@playwright/test';

test('local registration, workspace, project, logout and isolation', async ({ browser }) => {
  const one = await browser.newContext(); const two = await browser.newContext();
  const a = await one.newPage(); const b = await two.newPage();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const password = 'unique-local-test-password-42';
  async function signup(page: typeof a, name: string, email: string) {
    await page.goto('/signup'); await page.getByLabel('Jméno').fill(name); await page.getByLabel('E-mail').fill(email); await page.getByLabel(/Heslo/).fill(password); await page.getByRole('button', { name: 'Vytvořit účet' }).click();
    await expect(page.getByRole('heading', { name: `Vítejte, ${name}.` })).toBeVisible();
  }
  await signup(a, 'Test A', `a-${suffix}@example.com`);
  await expect(a.getByRole('heading', { name: 'Testovací kredity' })).toBeVisible(); await expect(a.getByText('10', { exact: true })).toBeVisible();
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
  const aProjectId = await a.locator('select').inputValue();
  await a.getByLabel('Název klíče').fill('Testovací klíč'); await a.getByRole('button', { name: 'Vytvořit klíč' }).click();
  const apiKey = await a.getByLabel('Nový API klíč').inputValue();
  const apiResult = await a.request.post('/api/v1/analyses', { headers: { Authorization: `Bearer ${apiKey}`, 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test zpráva', enableLlm: false } });
  expect(apiResult.status()).toBe(200); expect((await apiResult.json()).metadata.testCreditsCharged).toBe(1);
  await a.goto('/dashboard/playground'); await a.getByLabel(/Testovací API klíč/).fill(apiKey); await a.getByRole('button', { name: 'Odeslat test' }).click();
  await expect(a.getByRole('status')).toContainText('HTTP 200'); await expect(a.locator('pre')).toContainText('testCreditsCharged');
  await a.goto('/dashboard/api-keys');
  await expect(a.getByLabel('Nový API klíč')).toHaveCount(0);
  await a.getByRole('button', { name: 'Zrušit klíč' }).click(); await expect(a.getByText(/Zrušen/)).toBeVisible();
  const revoked = await a.request.post('/api/v1/analyses', { headers: { Authorization: `Bearer ${apiKey}`, 'Idempotency-Key': crypto.randomUUID() }, data: { text: 'Test zpráva', enableLlm: false } });
  expect(revoked.status()).toBe(401);
  const concurrent = await a.evaluate(async () => Promise.all(Array.from({ length: 20 }, async () => {
    const response = await fetch('/api/local/analyses', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ text: 'Test zpráva', enableLlm: false }) });
    return response.status;
  })));
  expect(concurrent.filter(status => status === 200)).toHaveLength(6);
  expect(concurrent.filter(status => status === 402)).toHaveLength(14);
  await a.goto('/dashboard'); await expect(a.getByText('0', { exact: true })).toBeVisible();
  await a.getByRole('link', { name: 'Projekty', exact: true }).click(); await a.getByLabel('Název nového projektu').fill('Projekt pouze A'); await a.getByRole('button', { name: 'Vytvořit projekt' }).click(); await expect(a.getByText('Projekt pouze A')).toBeVisible();
  await signup(b, 'Test B', `b-${suffix}@example.com`); await b.getByRole('link', { name: 'Projekty', exact: true }).click(); await expect(b.getByText('Projekt pouze A')).toHaveCount(0);
  const crossProject = await b.request.post('/api/local/api-keys', { headers: { Origin: 'http://127.0.0.1:3005' }, data: { name: 'forbidden', projectId: aProjectId } });
  expect(crossProject.status()).toBe(404);
  await a.getByRole('button', { name: 'Odhlásit se' }).click(); await expect(a).toHaveURL(/\/login/); await a.goto('/dashboard'); await expect(a).toHaveURL(/\/login/);
  await one.close(); await two.close();
});

test('developer playground sends real rules request', async ({ page }) => {
  await page.goto('/developers'); await page.getByRole('button', { name: 'Odeslat test' }).click();
  await expect(page.getByRole('status')).toContainText('HTTP 200'); await expect(page.locator('pre').last()).toContainText('schemaVersion');
});

test('public pages fit common viewport widths', async ({ page }) => {
  for (const width of [375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/analyze', '/pricing', '/developers', '/login', '/signup']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${path} at ${width}px`).toBe(false);
    }
  }
});
