import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './e2e', testMatch: '**/*.e2e.ts', timeout: 60000, expect: { timeout: 10000 }, use: { locale: 'cs-CZ', baseURL: process.env.OVERTO_BASE_URL || 'http://127.0.0.1:3005', browserName: 'chromium', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined } }, reporter: 'list' });
