'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { SlidersHorizontal } from 'lucide-react';
import { analyticsConsent, loadAnalytics, setAnalyticsConsent, trackBrowserError, trackEvent } from '@/observability/client';
import { pageName } from '@/observability/events';

export function AnalyticsConsent() {
  const path = usePathname();
  const locale = useLocale() === 'en' ? 'en' : 'cs';
  const [configured, setConfigured] = useState(false);
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null);
  const [editing, setEditing] = useState(false);
  const lastPage = useRef('');
  useEffect(() => {
    fetch('/api/analytics/config', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(config => { setChoice(analyticsConsent()); setConfigured(config?.enabled === true); })
      .catch(() => setConfigured(false));
  }, []);
  useEffect(() => {
    if (!configured || choice !== 'yes') return;
    void loadAnalytics();
    const current = pageName(path);
    if (lastPage.current !== `${current}:${locale}`) {
      lastPage.current = `${current}:${locale}`;
      trackEvent({ event: '$pageview', properties: { page: current, locale } });
    }
    const onError = () => trackBrowserError();
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onError);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onError); };
  }, [configured, choice, path, locale]);

  if (!configured) return null;
  const select = (enabled: boolean) => {
    setAnalyticsConsent(enabled);
    setChoice(enabled ? 'yes' : 'no');
    setEditing(false);
    if (!enabled) lastPage.current = '';
  };
  const show = choice === null || editing;
  const settingsLabel = locale === 'cs' ? 'Nastavení analytiky' : 'Analytics settings';
  return <div className="fixed bottom-4 right-4 z-50 max-w-sm px-3 sm:px-0">
    {show ? <section aria-label={locale === 'cs' ? 'Nastavení analytiky' : 'Analytics preferences'} className="rounded-xl border border-slate-300 bg-white p-4 text-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
      <h2 className="text-sm font-semibold">{locale === 'cs' ? 'Volitelná analytika' : 'Optional analytics'}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{locale === 'cs'
        ? 'S vaším souhlasem měříme jen souhrnné používání a kategorie chyb pomocí PostHog EU. Text zpráv, e-maily ani záznam obrazovky neposíláme. Analýza funguje i bez souhlasu.'
        : 'With your consent, PostHog EU receives limited usage and error categories. We do not send message text, email addresses or screen recordings. Analysis works without consent.'}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => select(false)} className="min-h-11 rounded-lg border border-slate-400 px-4 text-sm font-semibold dark:border-slate-600">{locale === 'cs' ? 'Odmítnout' : 'Decline'}</button>
        <button type="button" onClick={() => select(true)} className="min-h-11 rounded-lg bg-teal-800 px-4 text-sm font-semibold text-white">{locale === 'cs' ? 'Povolit analytiku' : 'Allow analytics'}</button>
      </div>
    </section> : <button type="button" onClick={() => setEditing(true)} aria-label={settingsLabel} title={settingsLabel} className="flex size-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><SlidersHorizontal size={18} aria-hidden="true" /></button>}
  </div>;
}
