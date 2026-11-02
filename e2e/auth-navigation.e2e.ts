import { test, expect } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

loadEnvConfig(process.cwd(), true);

test.describe('Authentication-Aware Navigation & Workspace Switching', () => {
  const origin = process.env.OVERTO_BASE_URL || 'http://127.0.0.1:3005';

  test('Guest: homepage shows Sign in, denies access to dashboard and admin', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/');

    // 2. Assert Sign in link is visible in header, Dashboard is absent
    const loginLink = page.locator('header.site-header a[href="/login"]');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toContainText(/Sign in|Přihlásit se/);

    const dashboardLink = page.locator('header.site-header a[href="/dashboard"]');
    await expect(dashboardLink).toHaveCount(0);

    const adminLink = page.locator('header.site-header a[href*="/admin"]');
    await expect(adminLink).toHaveCount(0);

    // 3. Visiting /dashboard directly redirects to /login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);

    // 4. Visiting /admin/operations directly results in 404 (adminContext notFound)
    const adminRes = await page.request.get(`${origin}/admin/operations`);
    expect(adminRes.status()).toBe(404);
  });

  test('Guest: mobile viewport (390px) shows proper header layout and Sign in', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const loginLink = page.locator('header.site-header a[href="/login"]');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toContainText(/Sign in|Přihlásit se/);
  });

  test('Authenticated user: header reflects Dashboard and personal workspace isolates admin', async ({ page }) => {
    const connectionString = process.env.OVERTO_DEV_DATABASE_URL;
    test.skip(!connectionString, 'Requires local test database');

    const address = new URL(connectionString!);
    if (address.hostname !== '127.0.0.1' || address.port !== '55443' || address.pathname !== '/overto') {
      test.skip(true, 'Dedicated local test database required');
      return;
    }

    const pool = new Pool({ connectionString });
    const email = `auth-nav-${randomUUID()}@example.com`;
    const password = `test-pass-${randomUUID()}`;
    const name = 'Standard Test User';

    try {
      // Create user and verify email
      const signup = await page.request.post('/api/auth/sign-up/email', {
        headers: { Origin: origin },
        data: { name, email, password },
      });
      expect(signup.status()).toBe(200);

      await pool.query('UPDATE "user" SET "emailVerified"=true WHERE email=$1', [email]);

      // Sign in via API or form
      const login = await page.request.post('/api/auth/sign-in/email', {
        headers: { Origin: origin },
        data: { email, password },
      });
      expect(login.status()).toBe(200);

      // Now open browser page with the session cookies
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();

      // Ordinary user: verify NO Admin Console in workspace
      await expect(page.locator('.workspace-switcher')).toHaveCount(0);
      await expect(page.locator('a[href="/admin/operations"]')).toHaveCount(0);

      // Visit public homepage while authenticated
      await page.goto('/');

      // Header should show Dashboard, NOT Sign in
      const dashboardHeaderLink = page.locator('header.site-header a[href="/dashboard"]');
      await expect(dashboardHeaderLink).toBeVisible();
      await expect(dashboardHeaderLink).toContainText(/Dashboard|Přehled/);

      const loginHeaderLink = page.locator('header.site-header a[href="/login"]');
      await expect(loginHeaderLink).toHaveCount(0);

      // Clicking Dashboard returns to /dashboard
      await dashboardHeaderLink.click();
      await expect(page).toHaveURL(/\/dashboard/);

      // Visiting /login while already authenticated redirects to /dashboard
      await page.goto('/login');
      await expect(page).toHaveURL(/\/dashboard/);

      // Sign out
      await page.getByRole('button', { name: /Sign out|Odhlásit se/ }).first().click();
      await expect(page).toHaveURL(/\/login/);

      // After sign out, visiting homepage shows Sign in again
      await page.goto('/');
      await expect(page.locator('header.site-header a[href="/login"]')).toBeVisible();
      await expect(page.locator('header.site-header a[href="/dashboard"]')).toHaveCount(0);
    } finally {
      await pool.end();
    }
  });

  test('ROOT Administrator: bidirectional switching between Personal Workspace and Admin Console', async ({ page }) => {
    test.skip(process.env.OVERTO_ADMIN_E2E !== 'true', 'Explicit local administrator acceptance run only');

    const connectionString = process.env.OVERTO_DEV_DATABASE_URL;
    test.skip(!connectionString, 'Requires local test database');

    const pool = new Pool({ connectionString });
    const email = `root-nav-${randomUUID()}@example.com`;
    const password = `test-pass-${randomUUID()}`;
    const name = 'Root Admin';

    try {
      // Check if ROOT already exists
      if ((await pool.query('SELECT 1 FROM platform_admins')).rowCount) {
        test.skip(true, 'Root admin slot already occupied');
        return;
      }

      // Create synthetic user
      const signup = await page.request.post('/api/auth/sign-up/email', {
        headers: { Origin: origin },
        data: { name, email, password },
      });
      expect(signup.status()).toBe(200);

      const userRes = await pool.query('UPDATE "user" SET "emailVerified"=true WHERE email=$1 RETURNING id', [email]);
      const userId = userRes.rows[0].id;

      // Assign ROOT role
      await pool.query("INSERT INTO platform_admins(user_id, role) VALUES ($1, 'ROOT')", [userId]);

      // Sign in
      const login = await page.request.post('/api/auth/sign-in/email', {
        headers: { Origin: origin },
        data: { email, password },
      });
      expect(login.status()).toBe(200);

      // 1. Visit Personal Dashboard
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/dashboard/);

      // Assert Admin Console switcher is visible with ROOT badge
      const adminSwitcher = page.locator('.workspace-switcher a[href="/admin/operations"]');
      await expect(adminSwitcher).toBeVisible();
      await expect(adminSwitcher).toContainText(/Admin Console|Administrace/);
      await expect(adminSwitcher).toContainText('ROOT');

      // Also present in nav links
      const adminNavLink = page.locator('.workspace-links a[href="/admin/operations"]');
      await expect(adminNavLink).toBeVisible();

      // 2. Click Admin Console switcher
      await adminSwitcher.click();
      await expect(page).toHaveURL(/\/admin\/operations/);
      await expect(page.getByRole('heading', { name: /Operations overview|Přehled provozu/ })).toBeVisible();

      // In Admin Console, assert Personal Workspace switcher is visible
      const personalSwitcher = page.locator('.workspace-switcher a[href="/dashboard"]');
      await expect(personalSwitcher).toBeVisible();
      await expect(personalSwitcher).toContainText(/Personal Workspace|Osobní prostor/);

      // 3. Click Personal Workspace switcher
      await personalSwitcher.click();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();

      // 4. Repeat switching multiple times to ensure session persistence
      await page.locator('.workspace-switcher a[href="/admin/operations"]').click();
      await expect(page).toHaveURL(/\/admin\/operations/);

      await page.locator('.workspace-switcher a[href="/dashboard"]').click();
      await expect(page).toHaveURL(/\/dashboard/);

      // 5. Test responsive mobile drawer (390px)
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('.workspace-mobile-nav summary').click();
      const mobileAdminSwitcher = page.locator('.workspace-mobile-panel .workspace-switcher a[href="/admin/operations"]');
      await expect(mobileAdminSwitcher).toBeVisible();

      // Clean up platform_admins for idempotency
      await pool.query('DELETE FROM platform_admins WHERE user_id=$1', [userId]);
    } finally {
      await pool.end();
    }
  });
});
