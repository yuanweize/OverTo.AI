import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { adminContext } from '@/server/admin/context';
import { AdminOperations } from '@/server/admin/operations';

export default async function OperationsPage() {
  const [{ pool }, t] = await Promise.all([adminContext(), getTranslations('AdminOps')]);
  const metrics = await new AdminOperations(pool).overview();
  const items = [
    { label: t('users'), value: metrics.users, href: '/admin/users' },
    { label: t('workspaces'), value: metrics.workspaces, href: '/admin/users' },
    { label: t('projects'), value: metrics.projects, href: '/admin/users' },
    { label: t('requestsToday'), value: metrics.requestsToday, href: '/admin/ai-studio' },
    { label: t('testSubscriptions'), value: metrics.testSubscriptions, href: '/admin/billing' },
  ];
  return <div><p className="admin-kicker">{t('eyebrow')}</p><h1 className="admin-title">{t('overview')}</h1><p className="admin-intro">{t('overviewIntro')}</p>
    <div className="admin-metrics">{items.map(item => <Link key={item.label} href={item.href}><span>{item.label}</span><strong>{item.value}</strong></Link>)}</div>
    <div className="admin-directory">{[
      ['/admin/users', t('users'), t('usersIntro')],
      ['/admin/billing', t('billing'), t('billingIntro')],
      ['/admin/audit', t('audit'), t('auditIntro')],
      ['/admin/system', t('system'), t('systemIntro')],
    ].map(([href, label, description]) => <Link key={href} href={href}><strong>{label}</strong><span>{description}</span><span aria-hidden="true">↗</span></Link>)}</div>
    <p className="admin-footnote">{t('localBoundary')}</p>
  </div>;
}
