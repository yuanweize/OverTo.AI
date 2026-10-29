import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth, pool } from '@/auth/server';
import { stripeTestConfig } from '@/billing/stripe-test';
import { personalWorkspace } from '@/auth/workspace';
import { CreateProject } from '@/components/account/CreateProject';
import { ProjectList } from '@/components/account/ProjectList';
import { ApiKeyManager } from '@/components/account/ApiKeyManager';
import { ApiPlayground } from '@/components/ApiPlayground';
import { ProfileSettings } from '@/components/account/ProfileSettings';
import { StripeTestBilling } from '@/components/account/StripeTestBilling';
const sections = new Set(['analyses','api-keys','playground','usage','billing','settings','projects']);
export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params; const t = await getTranslations('Dashboard'); const locale = await getLocale(); if (!sections.has(section)) notFound();
  if (!auth) redirect('/login'); const session = await auth.api.getSession({ headers: await headers() }); if (!session || !session.user.emailVerified) redirect('/login');
  const workspace = await personalWorkspace(session.user.id);
  const stripeConfig = section === 'billing' ? stripeTestConfig() : null;
  const billing = section === 'billing' && pool ? await pool.query<{ status: string; cancel_at_period_end: boolean }>('SELECT status,cancel_at_period_end FROM local_stripe_subscriptions WHERE workspace_id=$1', [workspace.workspaceId]) : null;
  return <><p className="text-sm font-semibold text-teal-800">{t('personal')}</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{t(`section_${section}_title`)}</h1><p className="mt-3 max-w-2xl leading-7 text-slate-700">{t(`section_${section}_description`)}</p><section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">{section === 'projects' ? <><ProjectList projects={workspace.projects.map(project => ({ id: project.id, name: project.name, archived: !!project.archived_at }))} defaultProjectId={workspace.defaultProjectId}/><CreateProject/></> : section === 'api-keys' ? <ApiKeyManager projects={workspace.projects.filter(project => !project.archived_at)} keys={workspace.keys.map(key => ({ ...key, expires_at: key.expires_at.toISOString(), revoked_at: key.revoked_at?.toISOString() ?? null }))}/> : section === 'playground' ? <ApiPlayground accountMode/> : section === 'billing' ? <StripeTestBilling enabled={!!stripeConfig} credits={stripeConfig?.credits ?? 0} subscription={billing?.rows[0] ? { status: billing.rows[0].status, cancelAtPeriodEnd: billing.rows[0].cancel_at_period_end } : null}/> : section === 'settings' ? <ProfileSettings initialName={session.user.name} email={session.user.email}/> : section === 'usage' ? <><h2 className="font-semibold">{t('recent')}</h2>{workspace.usage.length ? <ul className="mt-4 divide-y divide-slate-200">{workspace.usage.map((event, index) => <li key={index} className="py-4 text-sm text-slate-700">{event.mode === 'AI' ? 'AI' : t('rules')} · {event.provider_status} · {event.credits} {t('testCredits')} · {event.project_name} · {new Date(event.created_at).toLocaleString(locale==='cs'?'cs-CZ':'en-GB')}</li>)}</ul> : <p className="mt-3 text-sm text-slate-600">{t('noAnalyses')}</p>}</> : <><h2 className="font-semibold">{t('unavailable')}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t('unavailableNote')}</p><Link href="/dashboard" className="mt-4 inline-flex min-h-11 items-center font-semibold text-teal-800 underline">{t('back')}</Link></>}</section></>;
}
