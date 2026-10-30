import { getLocale, getTranslations } from 'next-intl/server';
import { adminContext } from '@/server/admin/context';
import { AdminOperations } from '@/server/admin/operations';

export default async function BillingAdminPage() {
  const [{ pool }, t, locale] = await Promise.all([adminContext(), getTranslations('AdminOps'), getLocale()]);
  const data = await new AdminOperations(pool).billing();
  const date = (value: Date) => new Date(value).toLocaleString(locale === 'cs' ? 'cs-CZ' : 'en-GB');
  return <div><p className="admin-kicker">{t('eyebrow')}</p><h1 className="admin-title">{t('billing')}</h1><p className="admin-intro">{t('billingIntro')}</p><p className="admin-footnote">{t('testOnly')}</p>
    <section className="admin-section"><h2>{t('subscriptions')}</h2>{data.subscriptions.length ? <div className="admin-table-wrap" role="region" aria-label={t('subscriptions')} tabIndex={0}><table className="admin-table"><thead><tr><th>{t('account')}</th><th>{t('status')}</th><th>{t('cancelAtPeriodEnd')}</th><th>{t('updated')}</th></tr></thead><tbody>{data.subscriptions.map((item, index) => <tr key={`${item.email}-${index}`}><td>{item.email}</td><td>{item.status}</td><td>{item.cancel_at_period_end ? t('yes') : t('no')}</td><td>{date(item.refreshed_at)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">{t('noSubscriptions')}</p>}</section>
    <section className="admin-section"><h2>{t('webhookEvents')}</h2>{data.events.length ? <div className="admin-table-wrap" role="region" aria-label={t('webhookEvents')} tabIndex={0}><table className="admin-table"><thead><tr><th>{t('event')}</th><th>{t('processed')}</th></tr></thead><tbody>{data.events.map((item, index) => <tr key={`${item.event_type}-${index}`}><td>{item.event_type}</td><td>{date(item.processed_at)}</td></tr>)}</tbody></table></div> : <p className="admin-empty">{t('noEvents')}</p>}</section>
  </div>;
}
