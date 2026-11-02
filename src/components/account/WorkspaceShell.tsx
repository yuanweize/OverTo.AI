'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ShieldCheck, SlidersHorizontal, Activity, LayoutDashboard, ScanText, History, Folder, KeyRound, Terminal, BarChart3, CreditCard, Settings, Menu, Cpu, Users, ScrollText, Server } from 'lucide-react';
import { Brand } from '@/components/branding/Brand';
import { Preferences } from '@/components/layout/Preferences';
import { LogoutButton } from './LogoutButton';

const navigation = [
  { key: 'overview', href: '/dashboard', icon: LayoutDashboard },
  { key: 'analyze', href: '/dashboard/analyze', icon: ScanText },
  { key: 'history', href: '/dashboard/analyses', icon: History },
  { key: 'projects', href: '/dashboard/projects', icon: Folder },
  { key: 'keys', href: '/dashboard/api-keys', icon: KeyRound },
  { key: 'playground', href: '/dashboard/playground', icon: Terminal },
  { key: 'usage', href: '/dashboard/usage', icon: BarChart3 },
  { key: 'billing', href: '/dashboard/billing', icon: CreditCard },
  { key: 'settings', href: '/dashboard/settings', icon: Settings },
] as const;

const adminNavigation = [
  { key: 'operations', href: '/admin/operations', icon: LayoutDashboard },
  { key: 'users', href: '/admin/users', icon: Users },
  { key: 'billing', href: '/admin/billing', icon: CreditCard },
  { key: 'audit', href: '/admin/audit', icon: ScrollText },
  { key: 'system', href: '/admin/system', icon: Server },
  { key: 'site', href: '/admin', icon: SlidersHorizontal },
  { key: 'studio', href: '/admin/ai-studio', icon: Activity },
  { key: 'providers', href: '/admin/ai-studio/providers', icon: Settings },
  { key: 'models', href: '/admin/ai-studio/models', icon: Cpu },
  { key: 'prompts', href: '/admin/ai-studio/prompts', icon: ScanText },
  { key: 'evaluations', href: '/admin/ai-studio/evaluations', icon: BarChart3 },
  { key: 'datasets', href: '/admin/ai-studio/datasets', icon: Folder },
  { key: 'workspace', href: '/dashboard', icon: ShieldCheck },
];

export function WorkspaceShell({
  name,
  email,
  children,
  admin = false,
  canAdmin = false,
  mode = 'selfhost',
}: {
  name: string;
  email: string;
  children: React.ReactNode;
  admin?: boolean;
  canAdmin?: boolean;
  mode?: 'local' | 'selfhost';
}) {
  const t = useTranslations(admin ? 'AdminNav' : 'Dashboard');
  const pathname = usePathname();
  const items = admin
    ? adminNavigation
    : canAdmin
      ? [...navigation, { key: 'adminConsole' as const, href: '/admin/operations', icon: ShieldCheck }]
      : navigation;
  const current = items.find((item) => item.href === pathname);
  const links = (
    <nav aria-label={t('navigation')} className="workspace-links">
      {items.map(({ key, href, icon: Icon }) => (
        <Link key={key} href={href} aria-current={pathname === href ? 'page' : undefined}>
          <Icon aria-hidden size={18} />
          <span>{t(key)}</span>
        </Link>
      ))}
    </nav>
  );

  const switchControl = canAdmin ? (
    <div className="workspace-switcher my-3">
      {admin ? (
        <Link
          href="/dashboard"
          className="flex min-h-11 items-center justify-between rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm hover:border-teal-600 dark:hover:border-teal-500 hover:text-teal-800 dark:hover:text-teal-300 transition-all"
        >
          <span className="flex items-center gap-2">
            <LayoutDashboard size={16} className="text-teal-700 dark:text-teal-400" />
            <span>{t('personalWorkspace')}</span>
          </span>
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">↗</span>
        </Link>
      ) : (
        <Link
          href="/admin/operations"
          className="flex min-h-11 items-center justify-between rounded-lg border border-teal-200/80 dark:border-teal-800/60 bg-teal-50/70 dark:bg-teal-950/40 px-3 py-2 text-xs font-semibold text-teal-950 dark:text-teal-200 shadow-sm hover:bg-teal-100/70 dark:hover:bg-teal-900/50 hover:border-teal-400 dark:hover:border-teal-700 transition-all"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-teal-700 dark:text-teal-400" />
            <span>{t('adminConsole')}</span>
          </span>
          <span className="rounded bg-teal-200/80 dark:bg-teal-900/80 px-1.5 py-0.5 text-[10px] font-bold text-teal-950 dark:text-teal-200">
            ROOT
          </span>
        </Link>
      )}
    </div>
  ) : null;

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Brand />
        <div className="workspace-desktop-nav">
          {switchControl}
          <p className="workspace-section-label">{t('personal')}</p>
          {links}
        </div>
        <details key={pathname} className="workspace-mobile-nav">
          <summary>
            <Menu aria-hidden size={18} />
            {t('navigation')}
          </summary>
          <div className="workspace-mobile-panel">
            {switchControl}
            {links}
            <LogoutButton />
          </div>
        </details>
        <div className="workspace-account">
          <p className="truncate font-semibold">{name}</p>
          <p className="muted truncate text-xs">{email}</p>
          <LogoutButton />
        </div>
      </aside>
      <div className="workspace-content">
        <header className="workspace-toolbar">
          <div>
            <span className="muted text-xs">{t('personal')}</span>
            <p className="font-semibold">{current ? t(current.key) : t('navigation')}</p>
          </div>
          <Preferences />
        </header>
        <div className="workspace-environment">
          <span className="status-dot" />
          {mode === 'local' ? t('localNotice') : t('selfhostNotice')}
        </div>
        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
