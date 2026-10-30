import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { adminContext } from '@/server/admin/context';
import { AdminOperations } from '@/server/admin/operations';
import { AdminUserActions } from '@/components/admin/AdminUserActions';

type Params = { q?: string | string[]; page?: string | string[] };
export default async function UsersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const [{ pool }, t, locale, params] = await Promise.all([adminContext(), getTranslations('AdminOps'), getLocale(), searchParams]);
  const query = typeof params.q === 'string' ? params.q : '';
  const page = typeof params.page === 'string' ? Number(params.page) : 1;
  const data = await new AdminOperations(pool).users(query, page);
  const href = (next: number) => `/admin/users?${new URLSearchParams({ q: data.query, page: String(next) })}`;
  return <div><p className="admin-kicker">{t('eyebrow')}</p><h1 className="admin-title">{t('users')}</h1><p className="admin-intro">{t('usersIntro')}</p>
    <form className="admin-search" action="/admin/users" method="get"><label htmlFor="admin-user-query">{t('searchUsers')}</label><div><input id="admin-user-query" name="q" maxLength={80} defaultValue={data.query} autoComplete="off"/><button type="submit" className="button button-primary">{t('search')}</button></div></form>
    {data.rows.length ? <div className="admin-table-wrap" role="region" aria-label={t('users')} tabIndex={0}><table className="admin-table"><thead><tr><th>{t('account')}</th><th>{t('verified')}</th><th>{t('workspace')}</th><th>{t('projects')}</th><th>{t('testCredits')}</th><th>{t('created')}</th><th>Akce</th></tr></thead><tbody>{data.rows.map(user => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td><span className="admin-state" data-state={user.verified ? 'ready' : 'pending'}>{user.verified ? t('yes') : t('no')}</span></td><td>{user.workspaceId ? t('personalWorkspace') : '—'}</td><td>{user.projects}</td><td>{user.granted} / {user.consumed}<small>{t('grantedUsed')}</small></td><td>{new Date(user.createdAt).toLocaleDateString(locale === 'cs' ? 'cs-CZ' : 'en-GB')}</td><td><AdminUserActions userId={user.id} userName={user.name} userEmail={user.email}/></td></tr>)}</tbody></table></div> : <p className="admin-empty">{t('noUsers')}</p>}
    <nav className="admin-pagination" aria-label={t('pages')}>{data.page > 1 && <Link href={href(data.page - 1)}>{t('previous')}</Link>}<span>{t('page', { page: data.page })}</span>{data.hasMore && <Link href={href(data.page + 1)}>{t('next')}</Link>}</nav>
  </div>;
}
