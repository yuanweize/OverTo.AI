import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const origin = 'http://127.0.0.1:3006';
const inbox = 'http://127.0.0.1:8026';

async function verificationLink(email: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const messages = await (await fetch(`${inbox}/api/v1/messages?limit=100`)).json();
    const match = messages.messages.find((item: { To: { Address: string }[]; Subject: string }) =>
      item.Subject === 'Ověření e-mailu — OvěřTo.AI' && item.To.some(to => to.Address === email));
    if (match) {
      const message = await (await fetch(`${inbox}/api/v1/message/${match.ID}`)).json();
      const url = String(message.Text).match(/http:\/\/127\.0\.0\.1:3006\/[^\s]+/)?.[0];
      if (url) return url;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Synthetic verification email not received');
}

test('fresh self-hosted install supports verified account, metered rules and root bootstrap', async ({ browser }) => {
  test.skip(process.env.OVERTO_SELFHOST_E2E !== 'true', 'Dedicated isolated Compose installation only');
  test.setTimeout(120000);
  const context = await browser.newContext({ locale: 'cs-CZ', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const email = `selfhost-${randomUUID()}@example.com`;
  const password = `synthetic-${randomUUID()}`;
  let rootAssigned = false;
  try {
    expect((await page.request.get(`${origin}/api/v1/health`)).status()).toBe(200);
    await page.goto(`${origin}/signup`);
    await page.getByLabel('Jméno').fill('Self-host test');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel(/Heslo/).fill(password);
    await page.getByRole('button', { name: 'Vytvořit účet' }).click();
    await expect(page).toHaveURL(/\/verify-email/);
    await page.goto(await verificationLink(email));
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Heslo').fill(password);
    await page.getByRole('button', { name: 'Přihlásit se' }).click();
    await expect(page.getByRole('heading', { name: 'Vítejte, Self-host test.' })).toBeVisible();
    await page.goto(`${origin}/dashboard/analyze`);
    await page.getByLabel('Vložte podezřelou zprávu').fill('Ahoj mami, mám nové číslo. Pošli mi ihned peníze.');
    await page.getByRole('button', { name: 'Pokračovat ke kontrole textu' }).click();
    await page.getByLabel(/Zkontroloval.a jsem text/).check();
    await page.getByRole('button', { name: 'Odeslat a analyzovat pravidly' }).click();
    await expect(page.getByText('Odečteno testovacích kreditů: 1')).toBeVisible();
    await page.goto(`${origin}/dashboard/api-keys`);
    await page.getByLabel('Název klíče').fill('Compose test key');
    await page.getByRole('button', { name: 'Vytvořit klíč' }).click();
    const key = await page.getByLabel('Nový API klíč').inputValue();
    const analysis = await page.request.post(`${origin}/api/v1/analyses`, { headers: { Authorization: `Bearer ${key}`, 'Idempotency-Key': randomUUID() }, data: { text: 'Podezřelá zpráva', enableLlm: false } });
    expect(analysis.status()).toBe(200);
    expect((await analysis.json()).metadata.testCreditsCharged).toBe(1);
    execFileSync('docker', ['compose', '--env-file', '.env.selfhost', '-f', 'compose.saas.yaml', 'run', '--rm', '--no-deps', 'migrate', './node_modules/.bin/tsx', 'scripts/bootstrap-admin.ts', email], { cwd: process.cwd(), stdio: 'pipe' });
    rootAssigned = true;
    await page.goto(`${origin}/admin/operations`);
    await expect(page.getByRole('heading', { name: 'Přehled provozu' })).toBeVisible();
    await page.goto(`${origin}/admin/ai-studio`);
    await expect(page.getByRole('heading', { name: 'AI Studio', exact: true })).toBeVisible();
  } finally {
    if (rootAssigned) {
      execFileSync('docker', ['compose', '--env-file', '.env.selfhost', '-f', 'compose.saas.yaml', 'exec', '-T', 'postgres', 'psql', '-U', 'overto', '-d', 'overto', '-c', `DELETE FROM platform_admins WHERE user_id=(SELECT id FROM "user" WHERE email='${email}')`], { cwd: process.cwd(), stdio: 'pipe' });
    }
    await context.close();
  }
});
