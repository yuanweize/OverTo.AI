'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { Languages, SunMoon } from 'lucide-react';
import { useInitialTheme } from '@/components/branding/SiteProvider';
export function Preferences() {
  const initialTheme = useInitialTheme();
  const locale = useLocale(); const t = useTranslations('Common');
  const [theme, setTheme] = useState(initialTheme); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (containerRef.current) containerRef.current.dataset.ready = 'true';
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  function updateLocale(value: string) {
    document.cookie = value === 'auto'
      ? 'overto-locale=; path=/; max-age=0; SameSite=Lax'
      : `overto-locale=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  }
  async function updateTheme(value: string) {
    setBusy(true); setError('');
    document.cookie = `overto-theme=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.dataset.themePreference = value;
    const effective = value === 'system'
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : value;
    document.documentElement.dataset.theme = effective;
    setTheme(value);
    try {
      const response = await fetch('/api/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: value }) });
      if (!response.ok) throw new Error();
    } catch { setError(t('saveError')); } finally { setBusy(false); }
  }
  return <div ref={containerRef} className="preferences"><label><Languages size={16} aria-hidden="true"/><span className="sr-only">{t('language')}</span><select aria-label={t('language')} value={locale} disabled={busy || !ready} onChange={e => updateLocale(e.target.value)}><option value="cs">Čeština</option><option value="en">English</option><option value="auto">{t('automatic')}</option></select></label><label><SunMoon size={16} aria-hidden="true"/><span className="sr-only">{t('appearance')}</span><select aria-label={t('appearance')} value={theme} disabled={busy || !ready} onChange={e => updateTheme(e.target.value)}><option value="system">{t('system')}</option><option value="light">{t('light')}</option><option value="dark">{t('dark')}</option></select></label>{error && <span role="alert">{error}</span>}</div>;
}
