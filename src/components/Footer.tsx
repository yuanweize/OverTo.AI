'use client';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Brand } from './branding/Brand';
import { GitHubIcon } from './branding/GitHubIcon';
export function Footer() {
  const t = useTranslations('Common');
  return <footer className="site-footer"><div className="shell footer-layout"><div><Brand/><p className="muted mt-4 max-w-md text-sm leading-6">{t('footerNotice')}</p></div><nav aria-label="Footer" className="flex flex-wrap gap-5"><Link href="/features">{t('features')}</Link><Link href="/how-it-works">{t('howItWorks')}</Link><Link href="/docs">{t('documentation')}</Link><Link href="/privacy">{t('privacy')}</Link><Link href="/security">{t('security')}</Link><Link href="/terms">{t('terms')}</Link><a href="https://github.com/yuanweize/OverTo.AI" className="inline-flex items-center gap-2"><GitHubIcon/>{t('source')}<ArrowUpRight size={14} aria-hidden="true"/></a></nav></div></footer>;
}
