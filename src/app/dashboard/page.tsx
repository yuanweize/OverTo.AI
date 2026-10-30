import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';

export default async function DashboardPage() {
  if (!auth) redirect('/login');
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user.emailVerified) redirect('/login');
  const t = await getTranslations('Dashboard');
  const data = await personalWorkspace(session.user.id);
  return <><p className="text-sm font-semibold text-teal-800">{t('personal')}</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{t('welcome',{name:session.user.name})}</h1><p className="mt-3 max-w-2xl leading-7 text-slate-700">{t('intro')}</p><div className="dashboard-metrics mt-8"><section><h2>{t('credits')}</h2><p className="dashboard-value">{data.balance.available}</p><p className="dashboard-detail">{t('creditNote')}</p></section><section><h2>{t('projects')}</h2><p className="dashboard-value">{data.projects.length}</p><Link href="/dashboard/projects" className="dashboard-detail inline-flex min-h-10 items-center font-semibold text-teal-800 underline">{t('viewProjects')}</Link></section><section><h2>{t('plan')}</h2><p className="dashboard-value dashboard-value-text">{t('local')}</p><p className="dashboard-detail">{t('noPayments')}</p></section></div><section className="dashboard-start mt-8"><div><h2 className="text-xl font-bold">{t('start')}</h2><p className="mt-2 max-w-xl leading-7 text-slate-700">{t('startNote')}</p></div><Link href="/dashboard/analyze" className="inline-flex min-h-12 items-center rounded-lg bg-teal-800 px-5 font-semibold text-white hover:bg-teal-900">{t('open')}</Link></section></>;
}
