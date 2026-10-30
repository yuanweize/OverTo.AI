'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Languages, SunMoon } from 'lucide-react';
import { useInitialTheme } from '@/components/branding/SiteProvider';
export function Preferences() {
  const initialTheme = useInitialTheme();
  const locale = useLocale(); const t = useTranslations('Common');
  const [theme, setTheme] = useState(initialTheme); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function update(value: { locale?: string; theme?: string }) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
      if (!response.ok) throw new Error();
      if (value.theme) { document.documentElement.dataset.theme = value.theme; setTheme(value.theme); }
      if (value.locale) window.location.reload();
    } catch { setError(t('saveError')); } finally { setBusy(false); }
  }
  return <div className="preferences"><label><Languages size={16} aria-hidden="true"/><span className="sr-only">{t('language')}</span><select aria-label={t('language')} value={locale} disabled={busy} onChange={e => update({ locale: e.target.value })}><option value="cs">Čeština</option><option value="en">English</option><option value="auto">{t('automatic')}</option></select></label><label><SunMoon size={16} aria-hidden="true"/><span className="sr-only">{t('appearance')}</span><select aria-label={t('appearance')} value={theme} disabled={busy} onChange={e => update({ theme: e.target.value })}><option value="system">{t('system')}</option><option value="light">{t('light')}</option><option value="dark">{t('dark')}</option></select></label>{error && <span role="alert">{error}</span>}</div>;
}
