import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth, pool } from '@/auth/server';
import { stripeTestConfig } from '@/billing/stripe-test';
import { billingConfig } from '@/billing/config';
import { BillingCatalog } from '@/billing/catalog';
import { personalWorkspace } from '@/auth/workspace';
import { CreateProject } from '@/components/account/CreateProject';
import { ProjectList } from '@/components/account/ProjectList';
import { ApiKeyManager } from '@/components/account/ApiKeyManager';
import { ApiPlayground } from '@/components/ApiPlayground';
import { ProfileSettings } from '@/components/account/ProfileSettings';
import { StripeTestBilling } from '@/components/account/StripeTestBilling';
import { CommercialBilling } from '@/components/account/CommercialBilling';
const sections = new Set(['analyses','api-keys','playground','usage','billing','settings','projects']);
export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params; const t = await getTranslations('Dashboard'); const locale = await getLocale(); if (!sections.has(section)) notFound();
  if (!auth) redirect('/login'); const session = await auth.api.getSession({ headers: await headers() }); if (!session || !session.user.emailVerified) redirect('/login');
  const workspace = await personalWorkspace(session.user.id);
  const commercialConfig = section === 'billing' ? billingConfig() : null;
  const commercialEnabled = !!commercialConfig && !!pool;
  const stripeConfig = section === 'billing' ? stripeTestConfig() : null;
  const billing = section === 'billing' && pool ? await pool.query<{ status: string; cancel_at_period_end: boolean }>('SELECT status,cancel_at_period_end FROM local_stripe_subscriptions WHERE workspace_id=$1', [workspace.workspaceId]) : null;
  const [plans, orders, invoices, subscription] = commercialEnabled ? await Promise.all([
    new BillingCatalog(pool!).current(),
    pool!.query<{ id: string; status: string; amount_minor: string; currency: string; created_at: Date; name_cs: string; name_en: string }>(`SELECT o.id,o.status,o.amount_minor,o.currency,o.created_at,p.name_cs,p.name_en FROM billing_orders o JOIN billing_plan_versions p ON p.id=o.plan_version_id WHERE o.mode=$1 AND o.workspace_id=$2 ORDER BY o.created_at DESC LIMIT 50`, [commercialConfig!.mode, workspace.workspaceId]),
    pool!.query<{ stripe_invoice_id: string; status: string; amount_paid_minor: string; currency: string; created_at: Date; hosted_invoice_url: string | null }>('SELECT stripe_invoice_id,status,amount_paid_minor,currency,created_at,hosted_invoice_url FROM billing_invoices WHERE mode=$1 AND workspace_id=$2 ORDER BY created_at DESC LIMIT 50', [commercialConfig!.mode, workspace.workspaceId]),
    pool!.query<{ status: string; cancel_at_period_end: boolean }>('SELECT status,cancel_at_period_end FROM billing_subscriptions WHERE mode=$1 AND workspace_id=$2', [commercialConfig!.mode, workspace.workspaceId]),
  ]) : [[], null, null, null] as const;
  const commercial = commercialEnabled && commercialConfig ? <CommercialBilling mode={commercialConfig.mode} locale={locale} checkoutEnabled={commercialConfig.checkoutEnabled}
    plans={plans.filter(plan => plan.kind !== 'FREE' && plan.is_purchasable && !!(commercialConfig.mode === 'test' ? plan.stripe_test_price_id : plan.stripe_live_price_id)).map(plan => ({ id: plan.id, name: locale === 'cs' ? plan.name_cs : plan.name_en, kind: plan.kind as 'MONTHLY' | 'CREDIT_PACK', amount: plan.amount_minor, currency: plan.currency, credits: plan.kind === 'MONTHLY' ? plan.monthly_credits : plan.pack_credits }))}
    orders={orders!.rows.map(order => ({ id: order.id, status: order.status, amount: order.amount_minor, currency: order.currency, createdAt: order.created_at.toISOString(), name: locale === 'cs' ? order.name_cs : order.name_en }))}
    invoices={invoices!.rows.map(invoice => ({ id: invoice.stripe_invoice_id, status: invoice.status, amount: invoice.amount_paid_minor, currency: invoice.currency, createdAt: invoice.created_at.toISOString(), url: invoice.hosted_invoice_url }))}
    subscription={subscription!.rows[0] ? { status: subscription!.rows[0].status, cancelAtPeriodEnd: subscription!.rows[0].cancel_at_period_end } : null}/> : null;
  return <><p className="text-sm font-semibold text-teal-800">{t('personal')}</p><h1 className="mt-2 text-3xl font-bold text-slate-950 dark:text-slate-100">{t(`section_${section}_title`)}</h1><p className="mt-3 max-w-2xl leading-7 text-slate-700 dark:text-slate-300">{t(`section_${section}_description`)}</p><section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">{section === 'projects' ? <><ProjectList projects={workspace.projects.map(project => ({ id: project.id, name: project.name, archived: !!project.archived_at }))} defaultProjectId={workspace.defaultProjectId}/><CreateProject/></> : section === 'api-keys' ? <ApiKeyManager projects={workspace.projects.filter(project => !project.archived_at)} keys={workspace.keys.map(key => ({ ...key, expires_at: key.expires_at.toISOString(), revoked_at: key.revoked_at?.toISOString() ?? null }))}/> : section === 'playground' ? <ApiPlayground accountMode/> : section === 'billing' ? (commercial ?? <StripeTestBilling enabled={!!stripeConfig} credits={stripeConfig?.credits ?? 0} subscription={billing?.rows[0] ? { status: billing.rows[0].status, cancelAtPeriodEnd: billing.rows[0].cancel_at_period_end } : null}/>) : section === 'settings' ? <ProfileSettings initialName={session.user.name} email={session.user.email}/> : section === 'usage' ? <><h2 className="font-semibold">{t('recent')}</h2>{workspace.usage.length ? <ul className="mt-4 divide-y divide-slate-200">{workspace.usage.map((event, index) => <li key={index} className="py-4 text-sm text-slate-700">{event.mode === 'AI' ? 'AI' : t('rules')} · {event.provider_status} · {event.credits} {t('testCredits')} · {event.project_name} · {new Date(event.created_at).toLocaleString(locale==='cs'?'cs-CZ':'en-GB')}</li>)}</ul> : <p className="mt-3 text-sm text-slate-600">{t('noAnalyses')}</p>}</> : <><h2 className="font-semibold">{t('unavailable')}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t('unavailableNote')}</p><Link href="/dashboard" className="mt-4 inline-flex min-h-11 items-center font-semibold text-teal-800 underline">{t('back')}</Link></>}</section></>;
}
