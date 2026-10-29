import { test, expect } from '@playwright/test';

test('public routes render in Czech and English across target viewports', async ({ browser }) => {
  const cases = [
    { width: 1440, locale: 'en-GB', dark: false, path: '/', file: 'v7-home-en-1440.png' },
    { width: 390, locale: 'cs-CZ', dark: true, path: '/', file: 'v7-home-cs-dark-390.png' },
    { width: 1440, locale: 'cs-CZ', dark: false, path: '/analyze', file: 'v7-analyze-cs-1440.png' },
    { width: 390, locale: 'en-GB', dark: true, path: '/analyze', file: 'v7-analyze-en-dark-390.png' },
    { width: 1024, locale: 'en-GB', dark: false, path: '/developers', file: 'v7-developers-en-1024.png' },
    { width: 390, locale: 'cs-CZ', dark: false, path: '/signup', file: 'v7-signup-cs-390.png' },
    { width: 1024, locale: 'en-GB', dark: true, path: '/login', file: 'v7-login-en-dark-1024.png' },
    { width: 375, locale: 'cs-CZ', dark: false, path: '/features', file: 'v7-features-cs-375.png' },
    { width: 390, locale: 'en-GB', dark: true, path: '/pricing', file: 'v7-pricing-en-dark-390.png' },
    { width: 768, locale: 'cs-CZ', dark: true, path: '/how-it-works', file: 'v7-how-cs-dark-768.png' },
    { width: 1024, locale: 'en-GB', dark: false, path: '/docs', file: 'v7-docs-en-1024.png' },
    { width: 1440, locale: 'cs-CZ', dark: false, path: '/pricing', file: 'v7-pricing-cs-1440.png' },
  ];
  for (const item of cases) {
    const context = await browser.newContext({ viewport: { width: item.width, height: 900 }, locale: item.locale, colorScheme: item.dark ? 'dark' : 'light' });
    const page = await context.newPage();
    const response = await page.goto(item.path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    if (process.env.OVERTO_CAPTURE_UI === 'true') await page.screenshot({ path: `assets/screenshots/${item.file}`, fullPage: true });
    await context.close();
  }
  for (const route of ['/security', '/privacy', '/terms']) {
    const context = await browser.newContext({ locale: 'en-GB' });
    const page = await context.newPage();
    expect((await page.goto(route))?.status()).toBe(200);
    await expect(page.locator('main h1')).toBeVisible();
    await context.close();
  }
});
