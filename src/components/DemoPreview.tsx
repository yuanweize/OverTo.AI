'use client';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowRight, Quote, ScanText, AlertTriangle } from 'lucide-react';
export function DemoPreview() {
  const t = useTranslations('Home'); const locale = useLocale();
  const [busy, setBusy] = useState(false); const [count, setCount] = useState<number | null>(null); const [failed, setFailed] = useState(false);
  async function run() {
    setBusy(true); setFailed(false);
    try {
      const response = await fetch('/api/v1/analyses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Ahoj mami, mám nové číslo. Pošli mi ihned peníze.', enableLlm: false }) });
      if (!response.ok) throw new Error(); const data = await response.json(); setCount(data.signals.length);
    } catch { setFailed(true); } finally { setBusy(false); }
  }
  return <section className="evidence-demo" aria-label={t('demoTitle')}><div className="demo-top"><ScanText size={20} aria-hidden="true"/><h2>{t('demoTitle')}</h2><span className="demo-live">API</span></div><p className="muted text-xs">{t('demoNote')}</p><blockquote><Quote size={22} aria-hidden="true"/><p>Ahoj mami, mám nové číslo. <mark>Pošli mi ihned peníze.</mark></p></blockquote><div className="demo-evidence"><span className="evidence-connector" aria-hidden="true"/><AlertTriangle size={19} aria-hidden="true"/><div><p className="font-semibold">{locale === 'en' ? 'An urgent payment request' : 'Naléhavá žádost o platbu'}</p><p className="muted text-sm leading-6">{locale === 'en' ? 'Contact your relative using a number you already know.' : 'Zavolejte příbuznému na číslo, které už znáte.'}</p></div></div><button type="button" onClick={run} disabled={busy} className="button button-primary w-full">{busy ? t('demoBusy') : t('demoRun')}<ArrowRight size={17} aria-hidden="true"/></button><p role="status" className="muted mt-3 text-sm">{failed ? t('demoError') : count === null ? t('demoEmpty') : `${t('demoRisk')}: ${count}`}</p></section>;
}
