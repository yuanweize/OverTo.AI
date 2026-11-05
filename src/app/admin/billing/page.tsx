import { getLocale, getTranslations } from 'next-intl/server';
import { adminContext } from '@/server/admin/context';
import { AdminOperations } from '@/server/admin/operations';
import { BillingCatalog } from '@/billing/catalog';
import { billingConfig } from '@/billing/config';
import { BillingPlanManager, type CatalogPlanRow } from '@/components/admin/BillingPlanManager';

export default async function BillingAdminPage() {
  const [{ pool }, t, locale] = await Promise.all([adminContext(), getTranslations('AdminOps'), getLocale()]);
  const data = await new AdminOperations(pool).billing();
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
  return <div><p className="admin-kicker">{t('eyebrow')}</p><h1 className="admin-title">{t('billing')}</h1><p className="admin-intro">{t('billingIntro')}</p><p className="admin-footnote">{t('testOnly')}</p>
    <BillingPlanManager plans={plans} mode={billingConfig()?.mode ?? 'disabled'}/>
    <section className="admin-section"><h2>{t('subscriptions')}</h2>{data.subscriptions.length ? <div className="admin-table-wrap" role="region" aria-label={t('subscriptions')} tabIndex={0}><table className="admin-table"><thead><tr><th>{t('account')}</th><th>{t('status')}</th><th>{t('cancelAtPeriodEnd')}</th><th>{t('updated')}</th></tr></thead><tbody>{data.subscriptions.map((item, index) => <tr key={`${item.email}-${index}`}><td>{item.email}</td><td>{item.status}</td><td>{item.cancel_at_period_end ? t('yes') : t('no')}</td><td>{date(item.refreshed_at)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">{t('noSubscriptions')}</p>}</section>
    <section className="admin-section"><h2>{t('webhookEvents')}</h2>{data.events.length ? <div className="admin-table-wrap" role="region" aria-label={t('webhookEvents')} tabIndex={0}><table className="admin-table"><thead><tr><th>{t('event')}</th><th>{t('processed')}</th></tr></thead><tbody>{data.events.map((item, index) => <tr key={`${item.event_type}-${index}`}><td>{item.event_type}</td><td>{date(item.processed_at)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">{t('noEvents')}</p>}</section>
  </div>;
}
