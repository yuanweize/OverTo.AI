'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Brand } from './branding/Brand';
import { useSite } from './branding/SiteProvider';
import { Preferences } from './layout/Preferences';
export function Header() {
  const t = useTranslations('Common'); const locale = useLocale(); const site = useSite();
  const announcement = locale === 'en' ? site.announcementEn : site.announcementCs;
  return <><a href="#main" className="skip-link">{t('skip')}</a>{announcement && <div className="announcement" role="status">{announcement}</div>}<header className="site-header"><div className="shell header-row"><Brand/><nav aria-label={t('navigation')}><Link href="/analyze">{t('analyze')}</Link><Link href="/developers">{t('developers')}</Link><Link href="/pricing">{t('pricing')}</Link><Link className="button button-secondary" href="/login">{t('login')}</Link></nav></div><div className="shell preference-row"><Preferences/></div></header></>;
}
