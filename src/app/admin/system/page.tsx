import { getTranslations } from 'next-intl/server';
import { adminContext } from '@/server/admin/context';
import { AdminOperations } from '@/server/admin/operations';

export default async function SystemPage() {
  const [{ pool }, t] = await Promise.all([adminContext(), getTranslations('AdminOps')]);
  const state = await new AdminOperations(pool).system();
  const checks = [
    [t('database'), !!state.database_time],
    [t('authSchema'), !!state.auth_schema],
    [t('ledgerSchema'), !!state.ledger_schema],
    [t('aiConfigured'), process.env.AI_ENABLED === 'true' && !!process.env.OPENAI_API_KEY],
  ] as const;
  return <div><p className="admin-kicker">{t('eyebrow')}</p><h1 className="admin-title">{t('system')}</h1><p className="admin-intro">{t('systemIntro')}</p>
    <dl className="admin-system">{checks.map(([label, ready]) => <div key={label}><dt>{label}</dt><dd><span className="admin-state" data-state={ready ? 'ready' : 'pending'}>{ready ? t('available') : t('unavailable')}</span></dd></div>)}</dl>
    <p className="admin-footnote">{t('systemBoundary')}</p>
  </div>;
}
