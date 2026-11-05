import { getLocale, getTranslations } from 'next-intl/server';
import { adminContext } from '@/server/admin/context';
import { AdminOperations } from '@/server/admin/operations';
import { BillingCatalog } from '@/billing/catalog';
import { billingConfigStatus } from '@/billing/config';
import { BillingPlanManager, type CatalogPlanRow } from '@/components/admin/BillingPlanManager';

export default async function BillingAdminPage() {
  const [{ pool }, t, locale] = await Promise.all([adminContext(), getTranslations('AdminOps'), getLocale()]);
  const data = await new AdminOperations(pool).billing();
  const billing = billingConfigStatus();
  const [commercialOrders, commercialEvents] = await Promise.all([
    pool.query<{ id: string; mode: string; workspace_id: string; code: string; kind: string; amount_minor: string; currency: string; credits: number; status: string; created_at: Date }>(`SELECT o.id,o.mode,o.workspace_id,p.code,o.kind,o.amount_minor,o.currency,o.credits,o.status,o.created_at
      FROM billing_orders o JOIN billing_plan_versions p ON p.id=o.plan_version_id ORDER BY o.created_at DESC LIMIT 100`),
    pool.query<{ mode: string; event_type: string; processed_at: Date }>('SELECT mode,event_type,processed_at FROM billing_webhook_events ORDER BY processed_at DESC LIMIT 50'),
  ]);
  const plans = (await new BillingCatalog(pool).history()).map((plan): CatalogPlanRow => ({
    id: plan.id, code: plan.code, version: plan.version, kind: plan.kind,
    nameCs: plan.name_cs, nameEn: plan.name_en, descriptionCs: plan.description_cs, descriptionEn: plan.description_en,
    currency: plan.currency as CatalogPlanRow['currency'], amountMinor: plan.amount_minor,
    monthlyCredits: plan.monthly_credits, packCredits: plan.pack_credits,
    isVisible: plan.is_visible, isPurchasable: plan.is_purchasable, sortOrder: plan.sort_order,
    stripeTestProductId: plan.stripe_test_product_id, stripeTestPriceId: plan.stripe_test_price_id,
    stripeLiveProductId: plan.stripe_live_product_id, stripeLivePriceId: plan.stripe_live_price_id,
    effectiveAt: plan.effective_at.toISOString(), retiredAt: plan.retired_at?.toISOString() ?? null,
  }));
  const date = (value: Date) => new Date(value).toLocaleString(locale === 'cs' ? 'cs-CZ' : 'en-GB');
  return <div><p className="admin-kicker">{t('eyebrow')}</p><h1 className="admin-title">{t('billing')}</h1><p className="admin-intro">{t('billingIntro')}</p><p className="admin-footnote">{billing.config?.checkoutEnabled ? (locale === 'cs' ? 'Komerční platby jsou zapnuté. Před změnami ověřte režim a údaje ve Stripe.' : 'Commercial payments are enabled. Verify mode and Stripe data before changes.') : t('testOnly')}</p>
    <BillingPlanManager plans={plans} mode={billing.config?.mode ?? 'disabled'} configurationIssue={billing.issue}/>
    <section className="admin-section"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2>{locale === 'cs' ? 'Obchodní objednávky' : 'Commercial orders'}</h2><p className="text-sm text-slate-600 dark:text-slate-400">{locale === 'cs' ? 'Posledních 100; údaje z PostgreSQL' : 'Latest 100; PostgreSQL records'}</p></div>{commercialOrders.rows.length ? <div className="admin-table-wrap" role="region" aria-label={locale === 'cs' ? 'Obchodní objednávky' : 'Commercial orders'} tabIndex={0}><table className="admin-table"><thead><tr><th>{t('updated')}</th><th>{t('account')}</th><th>{locale === 'cs' ? 'Režim' : 'Mode'}</th><th>{locale === 'cs' ? 'Tarif' : 'Plan'}</th><th>{locale === 'cs' ? 'Částka' : 'Amount'}</th><th>{t('status')}</th></tr></thead><tbody>{commercialOrders.rows.map(order => <tr key={order.id}><td>{date(order.created_at)}</td><td className="font-mono text-xs">{order.workspace_id}</td><td>{order.mode}</td><td>{order.code} · {order.credits}</td><td>{new Intl.NumberFormat(locale === 'cs' ? 'cs-CZ' : 'en-GB', { style: 'currency', currency: order.currency }).format(Number(order.amount_minor) / 100)}</td><td>{order.status}</td></tr>)}</tbody></table></div> : <p className="admin-empty">{locale === 'cs' ? 'Zatím žádné objednávky.' : 'No orders yet.'}</p>}</section>
    <section className="admin-section"><h2>{locale === 'cs' ? 'Obchodní webhooky' : 'Commercial webhooks'}</h2>{commercialEvents.rows.length ? <div className="admin-table-wrap" role="region" aria-label={locale === 'cs' ? 'Obchodní webhooky' : 'Commercial webhooks'} tabIndex={0}><table className="admin-table"><thead><tr><th>{locale === 'cs' ? 'Režim' : 'Mode'}</th><th>{t('event')}</th><th>{t('processed')}</th></tr></thead><tbody>{commercialEvents.rows.map((item, index) => <tr key={`${item.mode}-${item.event_type}-${index}`}><td>{item.mode}</td><td>{item.event_type}</td><td>{date(item.processed_at)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">{locale === 'cs' ? 'Zatím žádné události.' : 'No events yet.'}</p>}</section>
    <section className="admin-section"><h2>{t('subscriptions')}</h2>{data.subscriptions.length ? <div className="admin-table-wrap" role="region" aria-label={t('subscriptions')} tabIndex={0}><table className="admin-table"><thead><tr><th>{t('account')}</th><th>{t('status')}</th><th>{t('cancelAtPeriodEnd')}</th><th>{t('updated')}</th></tr></thead><tbody>{data.subscriptions.map((item, index) => <tr key={`${item.email}-${index}`}><td>{item.email}</td><td>{item.status}</td><td>{item.cancel_at_period_end ? t('yes') : t('no')}</td><td>{date(item.refreshed_at)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">{t('noSubscriptions')}</p>}</section>
    <section className="admin-section"><h2>{t('webhookEvents')}</h2>{data.events.length ? <div className="admin-table-wrap" role="region" aria-label={t('webhookEvents')} tabIndex={0}><table className="admin-table"><thead><tr><th>{t('event')}</th><th>{t('processed')}</th></tr></thead><tbody>{data.events.map((item, index) => <tr key={`${item.event_type}-${index}`}><td>{item.event_type}</td><td>{date(item.processed_at)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">{t('noEvents')}</p>}</section>
  </div>;
}
