import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const matrixScenarios = [
  { pref: 'light', os: 'light', expectedDataTheme: 'light', expectedHeaderRgb: 'rgb(255, 255, 255)', expectedHeroRgb: 'rgb(255, 255, 255)' },
  { pref: 'light', os: 'dark', expectedDataTheme: 'light', expectedHeaderRgb: 'rgb(255, 255, 255)', expectedHeroRgb: 'rgb(255, 255, 255)' },
  { pref: 'dark', os: 'light', expectedDataTheme: 'dark', expectedHeaderRgb: 'rgb(23, 37, 54)', expectedHeroRgb: 'rgb(13, 23, 35)' },
  { pref: 'dark', os: 'dark', expectedDataTheme: 'dark', expectedHeaderRgb: 'rgb(23, 37, 54)', expectedHeroRgb: 'rgb(13, 23, 35)' },
  { pref: 'system', os: 'light', expectedDataTheme: 'light', expectedHeaderRgb: 'rgb(255, 255, 255)', expectedHeroRgb: 'rgb(255, 255, 255)' },
  { pref: 'system', os: 'dark', expectedDataTheme: 'dark', expectedHeaderRgb: 'rgb(23, 37, 54)', expectedHeroRgb: 'rgb(13, 23, 35)' },
] as const;

test.describe('Theme Matrix and Contrast Verification', () => {
  for (const { pref, os, expectedDataTheme, expectedHeaderRgb, expectedHeroRgb } of matrixScenarios) {
    test(`Scenario pref=${pref} + os=${os} renders ${expectedDataTheme}`, async ({ browser }) => {
      const context = await browser.newContext({
        colorScheme: os,
        viewport: { width: 1280, height: 800 },
      });
      if (pref !== 'system') {
        await context.addCookies([
          { name: 'overto-theme', value: pref, domain: '127.0.0.1', path: '/' },
          { name: 'overto-theme', value: pref, domain: 'localhost', path: '/' },
        ]);
      }
      const page = await context.newPage();
      await page.goto('/');

      await expect(page.locator('html')).toHaveAttribute('data-theme', expectedDataTheme);
      await expect(page.locator('header.site-header')).toHaveCSS('background-color', expectedHeaderRgb);
      await expect(page.locator('.home-hero-wrap')).toHaveCSS('background-color', expectedHeroRgb);

      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(a11y.violations.map(v => ({ rule: v.id, impact: v.impact }))).toEqual([]);

      await context.close();
    });
  }

  test('Interactive preference switcher updates data-theme and styles without reload', async ({ browser }) => {
    const context = await browser.newContext({
      locale: 'en-US',
      colorScheme: 'light',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('.home-hero-wrap')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    const darkPref = page.waitForResponse(res => res.url().includes('/api/preferences') && res.status() === 200);
    await page.getByLabel('Appearance').selectOption('dark');
    await darkPref;

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('header.site-header')).toHaveCSS('background-color', 'rgb(23, 37, 54)');
    await expect(page.locator('.home-hero-wrap')).toHaveCSS('background-color', 'rgb(13, 23, 35)');

    const lightPref = page.waitForResponse(res => res.url().includes('/api/preferences') && res.status() === 200);
    await page.getByLabel('Appearance').selectOption('light');
    await lightPref;

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('.home-hero-wrap')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    await context.close();
  });
});
