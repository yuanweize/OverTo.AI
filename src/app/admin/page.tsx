import { headers } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getPlatformAdmin } from '@/server/config/admin';
import { getSiteSnapshot } from '@/server/config/site';
import { pool } from '@/auth/server';
import { SiteSettingsForm } from '@/features/settings/SiteSettingsForm';
import { validateSiteConfig } from '@/server/config/site-schema';
export default async function AdminPage() {
  const [user,t] = await Promise.all([getPlatformAdmin(await headers()),getTranslations('Admin')]);
  if (!user || !pool) return <><Header/><main id="main" className="shell py-16"><h1 className="text-3xl font-bold">{t('title')}</h1><p className="mt-5 text-lg">{t('denied')}</p><p className="muted mt-3 max-w-2xl leading-7">{t('bootstrap')}</p><Link href="/login" className="button button-primary mt-6">{(await getTranslations('Common'))('login')}</Link></main><Footer/></>;
  const [snapshot,audit]=await Promise.all([getSiteSnapshot(),pool.query('SELECT version,after_config,created_at FROM platform_settings_audit ORDER BY version DESC LIMIT 15')]);
  return <div><h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1><p className="muted mt-3 mb-9">{t('intro')}</p><Link href="/admin/ai-studio" className="button button-secondary mb-6">AI Studio</Link><SiteSettingsForm initial={snapshot} history={audit.rows.map(row=>({version:row.version,config:validateSiteConfig(row.after_config),createdAt:row.created_at.toISOString()}))}/></div>;
}
