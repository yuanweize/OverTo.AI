import { getLocale, getTranslations } from 'next-intl/server';
import { adminContext } from '@/server/admin/context';
import { AdminOperations } from '@/server/admin/operations';

export default async function AuditPage() {
  const [{ pool }, t, locale] = await Promise.all([adminContext(), getTranslations('AdminOps'), getLocale()]);
  const rows = await new AdminOperations(pool).audit();
  return <div><p className="admin-kicker">{t('eyebrow')}</p><h1 className="admin-title">{t('audit')}</h1><p className="admin-intro">{t('auditIntro')}</p><p className="admin-footnote">{t('auditPrivacy')}</p>
    {rows.length ? <div className="admin-table-wrap" role="region" aria-label={t('audit')} tabIndex={0}><table className="admin-table"><thead><tr><th>{t('when')}</th><th>{t('actor')}</th><th>{t('source')}</th><th>{t('action')}</th><th>{t('target')}</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.source}-${index}`}><td>{new Date(row.created_at).toLocaleString(locale === 'cs' ? 'cs-CZ' : 'en-GB')}</td><td>{row.actor}</td><td>{row.source}</td><td>{row.action}</td><td>{row.target ?? '—'}</td></tr>)}</tbody></table></div> : <p className="admin-empty">{t('noAudit')}</p>}
  </div>;
}
