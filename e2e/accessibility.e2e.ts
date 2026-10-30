import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const publicScreens = [
  { route: '/', locale: 'cs-CZ', theme: 'light', width: 1440 },
  { route: '/', locale: 'en-GB', theme: 'dark', width: 390 },
  { route: '/analyze', locale: 'cs-CZ', theme: 'dark', width: 390 },
  { route: '/pricing', locale: 'en-GB', theme: 'light', width: 768 },
  { route: '/developers', locale: 'cs-CZ', theme: 'dark', width: 1024 },
  { route: '/docs', locale: 'en-GB', theme: 'light', width: 1440 },
  { route: '/signup', locale: 'cs-CZ', theme: 'light', width: 390 },
  { route: '/login', locale: 'en-GB', theme: 'dark', width: 390 },
] as const;

test('public screens meet automated WCAG A/AA checks', async ({ browser }) => {
  for (const screen of publicScreens) {
    const context = await browser.newContext({
      viewport: { width: screen.width, height: 900 },
      locale: screen.locale,
      colorScheme: screen.theme,
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      expect((await page.goto(screen.route))?.status()).toBe(200);
      await expect(page.locator('main h1')).toBeVisible();
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(result.violations.map(v => ({ rule: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) })), `${screen.route} ${screen.locale} ${screen.theme} ${screen.width}px`).toEqual([]);
      if (process.env.OVERTO_CAPTURE_A11Y === 'true' && screen.route === '/developers') {
        await page.screenshot({ path: 'assets/screenshots/v7-developers-cs-dark-1024-a11y.png', fullPage: true });
      }
    } finally {
      await context.close();
    }
  }
});
