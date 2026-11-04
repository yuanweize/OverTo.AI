'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Pricing = { model: string; inputPerMillionUsd: number; outputPerMillionUsd: number; maxRequestCostUsd: number; verified: boolean };

export function ModelPricingForm({ models, pricing }: { models: string[]; pricing: Pricing[] }) {
  const t = useTranslations('Models');
  const [rows, setRows] = useState(pricing);
  const [model, setModel] = useState(models[0] || '');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [maximum, setMaximum] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const selected = rows.find(row => row.model === model);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/ai-studio/pricing', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, inputPerMillionUsd: Number(input), outputPerMillionUsd: Number(output), maxRequestCostUsd: Number(maximum), confirmCurrentProviderPricing: confirmed }),
      });
      const body = await response.json();
      if (!response.ok) { setMessage(t('pricingError')); return; }
      setRows(previous => [...previous.filter(row => row.model !== model), body]);
      setConfirmed(false); setMessage(t('pricingSaved'));
    } catch { setMessage(t('pricingError')); }
    finally { setBusy(false); }
  }

  return <form onSubmit={save} className="mt-8 max-w-3xl space-y-5 border-t border-slate-200 pt-8 dark:border-slate-700">
    <div><h2 className="text-xl font-semibold">{t('pricingTitle')}</h2><p className="muted mt-2 text-sm leading-6">{t('pricingNote')}</p></div>
    <label className="block text-sm font-semibold">{t('pricingModel')}<select className="studio-input" value={model} onChange={event => { setModel(event.target.value); setInput(''); setOutput(''); setMaximum(''); setConfirmed(false); setMessage(''); }}>{models.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
    <p className="text-sm">{selected?.verified ? t('pricingVerified') : t('pricingUnverified')}</p>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="block text-sm font-semibold">{t('inputPrice')}<input className="studio-input" type="number" min="0" max="1000" step="any" required value={input} onChange={event => setInput(event.target.value)}/></label>
      <label className="block text-sm font-semibold">{t('outputPrice')}<input className="studio-input" type="number" min="0" max="1000" step="any" required value={output} onChange={event => setOutput(event.target.value)}/></label>
      <label className="block text-sm font-semibold">{t('requestCeiling')}<input className="studio-input" type="number" min="0.000001" max="10" step="any" required value={maximum} onChange={event => setMaximum(event.target.value)}/></label>
    </div>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required/><span>{t('confirmPricing')}</span></label>
    <button className="button button-primary" type="submit" disabled={busy || !model || !confirmed}>{busy ? t('saving') : t('savePricing')}</button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
