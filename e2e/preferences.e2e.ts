import { test, expect } from '@playwright/test';

test('browser language, explicit overrides and real homepage example', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US', colorScheme: 'dark', viewport: { width: 375, height: 900 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('header')).toHaveCSS('background-color', 'rgb(23, 37, 54)');
  await page.getByRole('button', { name: 'Analyze the example' }).click();
  await expect(page.getByRole('status')).toContainText(/Signals found: [1-9]/);
  await page.getByLabel('Appearance').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('header')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.getByLabel('Language').selectOption('cs');
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await context.close();
});
test('unsupported browser language falls back to Czech', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'de-DE' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  const response = await page.request.put('/api/admin/site', { headers: { Origin: 'http://127.0.0.1:3005' }, data: { version: 0, config: { siteName: 'Unauthorized' } } });
  expect(response.status()).toBe(403);
  const config = await (await page.request.get('/api/site')).json();
  expect(Object.keys(config.config).sort()).toEqual(['announcementCs','announcementEn','brandColor','contactEmail','defaultLocale','defaultTheme','descriptionCs','descriptionEn','logoPath','siteName','supportUrl'].sort());
  await context.close();
});

test('English analysis preserves Czech evidence and provides localized verification', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-GB' });
  const page = await context.newPage();
  await page.goto('/analyze');
  await page.getByLabel('Paste a suspicious message').fill('Ahoj mami, mám nové číslo. Pošli mi ihned peníze.');
  await page.getByRole('button', { name: 'Continue to text review' }).click();
  await page.getByLabel('I reviewed the text and removed information I do not want to send.').check();
  await page.getByRole('button', { name: 'Send and analyze with rules' }).click();
  await expect(page.getByRole('heading', { name: 'High risk', exact: true })).toBeVisible();
  await expect(page.getByText('Call your relative on their previously known number', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Locate in the edited message' }).first().click();
  const source = page.getByLabel('Edited message', { exact: true });
  await expect(source.locator('mark')).toContainText('Ahoj mami');
  await page.getByLabel('I sent money', { exact: true }).check();
  await expect(page.getByText(/Ask it to investigate and whether the payment can be stopped/)).toBeVisible();
  await context.close();
});
