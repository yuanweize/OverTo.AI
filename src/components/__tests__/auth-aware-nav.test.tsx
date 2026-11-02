import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import messagesEn from '@/i18n/messages/en.json';
import messagesCs from '@/i18n/messages/cs.json';
import { Header } from '../Header';
import { WorkspaceShell } from '../account/WorkspaceShell';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Mock site provider, brand and preferences
vi.mock('../branding/Brand', () => ({
  Brand: () => <div data-testid="brand">OvěřTo.AI</div>,
}));
vi.mock('../branding/SiteProvider', () => ({
  useSite: () => ({ announcementEn: '', announcementCs: '' }),
}));
vi.mock('../layout/Preferences', () => ({
  Preferences: () => <div data-testid="preferences">Preferences</div>,
}));
vi.mock('../account/LogoutButton', () => ({
  LogoutButton: () => <button data-testid="logout">Sign out</button>,
}));

const mockSessionState: {
  data: { user: { id: string; name: string; email: string; emailVerified: boolean }; session: { id: string } } | null;
  isPending: boolean;
} = {
  data: null,
  isPending: false,
};

vi.mock('@/auth/client', () => ({
  authClient: {
    useSession: () => mockSessionState,
  },
}));

describe('Authentication-Aware Navigation & Workspace Switching', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mockSessionState.data = null;
    mockSessionState.isPending = false;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  describe('Public Header Navigation', () => {
    it('shows neutral loading state when session is pending', async () => {
      mockSessionState.isPending = true;
      mockSessionState.data = null;

      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="en" messages={messagesEn}>
            <Header />
          </NextIntlClientProvider>
        );
      });

      const loadingPlaceholder = container.querySelector('[aria-hidden="true"].pointer-events-none');
      expect(loadingPlaceholder).toBeDefined();
      expect(container.textContent).not.toContain('Sign in');
      expect(container.textContent).not.toContain('Dashboard');
    });

    it('shows Sign in link for guest (unauthenticated)', async () => {
      mockSessionState.isPending = false;
      mockSessionState.data = null;

      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="en" messages={messagesEn}>
            <Header />
          </NextIntlClientProvider>
        );
      });

      const loginLink = container.querySelector('a[href="/login"]');
      expect(loginLink).toBeDefined();
      expect(loginLink?.textContent).toContain('Sign in');
      expect(container.querySelector('a[href="/dashboard"]')).toBeNull();
    });

    it('shows Dashboard link for authenticated user with verified email (English)', async () => {
      mockSessionState.isPending = false;
      mockSessionState.data = {
        user: { id: 'u1', name: 'Alice', email: 'alice@example.com', emailVerified: true },
        session: { id: 's1' },
      };

      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="en" messages={messagesEn}>
            <Header />
          </NextIntlClientProvider>
        );
      });

      const dashboardLink = container.querySelector('a[href="/dashboard"]');
      expect(dashboardLink).toBeDefined();
      expect(dashboardLink?.textContent).toContain('Dashboard');
      expect(container.querySelector('a[href="/login"]')).toBeNull();
    });

    it('shows Přehled link for authenticated user with verified email (Czech)', async () => {
      mockSessionState.isPending = false;
      mockSessionState.data = {
        user: { id: 'u1', name: 'Jan', email: 'jan@example.com', emailVerified: true },
        session: { id: 's1' },
      };

      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="cs" messages={messagesCs}>
            <Header />
          </NextIntlClientProvider>
        );
      });

      const dashboardLink = container.querySelector('a[href="/dashboard"]');
      expect(dashboardLink).toBeDefined();
      expect(dashboardLink?.textContent).toContain('Přehled');
      expect(container.querySelector('a[href="/login"]')).toBeNull();
    });

    it('shows Sign in if user is not verified', async () => {
      mockSessionState.isPending = false;
      mockSessionState.data = {
        user: { id: 'u1', name: 'Alice', email: 'alice@example.com', emailVerified: false },
        session: { id: 's1' },
      };

      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="en" messages={messagesEn}>
            <Header />
          </NextIntlClientProvider>
        );
      });

      const loginLink = container.querySelector('a[href="/login"]');
      expect(loginLink).toBeDefined();
      expect(loginLink?.textContent).toContain('Sign in');
      expect(container.querySelector('a[href="/dashboard"]')).toBeNull();
    });
  });

  describe('Workspace Shell and Switching', () => {
    it('ordinary user sees only regular workspace navigation and no admin links', async () => {
      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="en" messages={messagesEn}>
            <WorkspaceShell name="Bob" email="bob@example.com" admin={false} canAdmin={false}>
              <div>Content</div>
            </WorkspaceShell>
          </NextIntlClientProvider>
        );
      });

      // No admin console links
      const adminLinks = container.querySelectorAll('a[href="/admin/operations"]');
      expect(adminLinks.length).toBe(0);

      // No workspace switcher
      expect(container.querySelector('.workspace-switcher')).toBeNull();

      // Regular links present
      expect(container.querySelector('a[href="/dashboard"]')).toBeDefined();
      expect(container.querySelector('a[href="/dashboard/analyze"]')).toBeDefined();
      expect(container.querySelector('a[href="/dashboard/api-keys"]')).toBeDefined();
    });

    it('ROOT user in personal workspace sees Admin Console link and switcher', async () => {
      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="en" messages={messagesEn}>
            <WorkspaceShell name="Root User" email="root@example.com" admin={false} canAdmin={true}>
              <div>Content</div>
            </WorkspaceShell>
          </NextIntlClientProvider>
        );
      });

      // Switcher present with link to /admin/operations
      const switcher = container.querySelector('.workspace-switcher');
      expect(switcher).toBeDefined();
      const switcherLink = switcher?.querySelector('a[href="/admin/operations"]');
      expect(switcherLink).toBeDefined();
      expect(switcherLink?.textContent).toContain('Admin Console');
      expect(switcherLink?.textContent).toContain('ROOT');

      // Admin Console also in navigation links
      const navAdminLink = container.querySelector('.workspace-links a[href="/admin/operations"]');
      expect(navAdminLink).toBeDefined();
      expect(navAdminLink?.textContent).toContain('Admin Console');
    });

    it('ROOT user in Admin Console sees Personal Workspace switcher to /dashboard', async () => {
      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="en" messages={messagesEn}>
            <WorkspaceShell name="Root User" email="root@example.com" admin={true} canAdmin={true}>
              <div>Admin Content</div>
            </WorkspaceShell>
          </NextIntlClientProvider>
        );
      });

      // Switcher present with link to /dashboard
      const switcher = container.querySelector('.workspace-switcher');
      expect(switcher).toBeDefined();
      const switcherLink = switcher?.querySelector('a[href="/dashboard"]');
      expect(switcherLink).toBeDefined();
      expect(switcherLink?.textContent).toContain('Personal Workspace');

      // Admin navigation items present
      expect(container.querySelector('a[href="/admin/operations"]')).toBeDefined();
      expect(container.querySelector('a[href="/admin/users"]')).toBeDefined();
      expect(container.querySelector('a[href="/admin/system"]')).toBeDefined();
    });

    it('translates correctly in Czech', async () => {
      await act(async () => {
        root.render(
          <NextIntlClientProvider locale="cs" messages={messagesCs}>
            <WorkspaceShell name="Správce" email="root@example.com" admin={false} canAdmin={true}>
              <div>Obsah</div>
            </WorkspaceShell>
          </NextIntlClientProvider>
        );
      });

      const switcherLink = container.querySelector('.workspace-switcher a[href="/admin/operations"]');
      expect(switcherLink?.textContent).toContain('Administrace');
    });
  });
});
