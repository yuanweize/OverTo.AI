import { expect, test } from '@playwright/test';

test('analytics is consent-gated and never sends URL queries', async ({ browser }) => {
  test.skip(process.env.OVERTO_POSTHOG_E2E !== 'true', 'Isolated PostHog QA deployment only');
  const origin = 'http://127.0.0.1:3016';
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
  // PostHog intentionally filters automation; this only makes the synthetic browser observable.
  await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); Object.defineProperty(navigator, 'userAgentData', { get: () => ({ brands: [{ brand: 'Chromium', version: '130' }] }) }); });
  const page = await context.newPage();
  const sent: string[] = [];
  await page.route('https://*.posthog.com/**', async route => {
    const hostname = new URL(route.request().url()).hostname;
    const body = route.request().postData();
    if (body && hostname === 'eu.i.posthog.com') sent.push(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"autocapture":false,"featureFlags":{},"supportedCompression":[]}' });
  });
  await page.goto(`${origin}/?access_token=synthetic-private-token`);
  await expect(page.getByRole('button', { name: 'Povolit analytiku' })).toBeVisible();
  await page.getByRole('button', { name: 'Odmítnout' }).click();
  await page.waitForTimeout(300);
  expect(sent).toHaveLength(0);
  await page.getByRole('button', { name: 'Nastavení analytiky' }).click();
  await page.getByRole('button', { name: 'Povolit analytiku' }).click();
  await expect.poll(() => sent.length, { timeout: 15000 }).toBeGreaterThan(0);
  expect(sent.join(' ')).not.toContain('synthetic-private-token');
  expect(sent.join(' ')).toContain('overto_ai');
  expect(sent.join(' ')).toContain('qa');
  expect(sent.join(' ')).toContain('schema_version');
  expect(sent.join(' ')).toContain('$pageview');
  await page.screenshot({ path: '/tmp/overto-ai-mock/analytics-enabled.png', fullPage: true });
  const count = sent.length;
  await page.getByRole('button', { name: 'Nastavení analytiky' }).click();
  await page.getByRole('button', { name: 'Odmítnout' }).click();
  await page.goto(`${origin}/analyze?secret=another-private-token`);
  await page.waitForTimeout(500);
  expect(sent).toHaveLength(count);
  await page.getByRole('button', { name: 'Nastavení analytiky' }).click();
  await page.getByRole('button', { name: 'Povolit analytiku' }).click();
  await expect.poll(() => sent.length, { timeout: 15000 }).toBeGreaterThan(count);
  expect(sent.join(' ')).not.toContain('another-private-token');
  await context.close();
});
