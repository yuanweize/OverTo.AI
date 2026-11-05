'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type CatalogPlanRow = {
  id: string; code: string; version: number; kind: 'FREE' | 'MONTHLY' | 'CREDIT_PACK';
  nameCs: string; nameEn: string; descriptionCs: string; descriptionEn: string;
  currency: 'CZK' | 'EUR' | 'USD'; amountMinor: string; monthlyCredits: number; packCredits: number;
  isVisible: boolean; isPurchasable: boolean; sortOrder: number;
  stripeTestProductId: string | null; stripeTestPriceId: string | null;
  stripeLiveProductId: string | null; stripeLivePriceId: string | null;
  effectiveAt: string; retiredAt: string | null;
};

type Draft = Omit<CatalogPlanRow, 'id' | 'version' | 'amountMinor' | 'effectiveAt' | 'retiredAt'> & {
  amount: string; effectiveAt: string; retiredAt: string; reason: string;
};
const dateInput = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const emptyDraft = (): Draft => ({
  code: '', kind: 'MONTHLY', nameCs: '', nameEn: '', descriptionCs: '', descriptionEn: '',
  currency: 'CZK', amount: '', monthlyCredits: 0, packCredits: 0, isVisible: false, isPurchasable: false,
  sortOrder: 0, stripeTestProductId: null, stripeTestPriceId: null, stripeLiveProductId: null,
  stripeLivePriceId: null, effectiveAt: '', retiredAt: '', reason: '',
});

function parseMinor(value: string): number | null {
  if (!/^\d{1,8}(?:[.,]\d{1,2})?$/.test(value)) return null;
  const [major, fraction = ''] = value.replace(',', '.').split('.');
  return Number(major) * 100 + Number(fraction.padEnd(2, '0'));
}

export function BillingPlanManager({ plans, mode }: { plans: CatalogPlanRow[]; mode: 'disabled' | 'test' | 'live' }) {
  const t = useTranslations('BillingCatalog');
  const locale = useLocale();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pending = useRef<{ payload: string; id: string } | null>(null);
  const textField = (name: keyof Draft, label: string, required = false) =>
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{label}
      <input name={name} type={['monthlyCredits', 'packCredits', 'sortOrder'].includes(name) ? 'number' : 'text'} inputMode={name === 'amount' ? 'decimal' : undefined} required={required} value={String(draft[name] ?? '')} onChange={event => setDraft(current => ({ ...current, [name]: event.target.value }))}
        className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-offset-2 focus:border-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
    </label>;
  function edit(plan: CatalogPlanRow) {
    setDraft({ ...plan, amount: (Number(plan.amountMinor) / 100).toFixed(2), effectiveAt: dateInput(new Date().toISOString()), retiredAt: '', reason: '' });
    pending.current = null; setError(''); setSuccess(''); setOpen(true);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess('');
    const amountMinor = parseMinor(draft.amount);
    if (amountMinor === null) { setError(t('invalidAmount')); return; }
    const payload = JSON.stringify({
      code: draft.code.trim(), kind: draft.kind, nameCs: draft.nameCs, nameEn: draft.nameEn,
      descriptionCs: draft.descriptionCs, descriptionEn: draft.descriptionEn, currency: draft.currency,
      amountMinor, monthlyCredits: Number(draft.monthlyCredits), packCredits: Number(draft.packCredits),
      isVisible: draft.isVisible, isPurchasable: draft.isPurchasable, sortOrder: Number(draft.sortOrder),
      stripeTestProductId: draft.stripeTestProductId?.trim() || null, stripeTestPriceId: draft.stripeTestPriceId?.trim() || null,
      stripeLiveProductId: draft.stripeLiveProductId?.trim() || null, stripeLivePriceId: draft.stripeLivePriceId?.trim() || null,
      effectiveAt: new Date(draft.effectiveAt).toISOString(), retiredAt: draft.retiredAt ? new Date(draft.retiredAt).toISOString() : null,
      reason: draft.reason,
    });
    if (!window.confirm(t('confirmPublish'))) return;
    if (!pending.current || pending.current.payload !== payload) pending.current = { payload, id: crypto.randomUUID() };
    setBusy(true);
    try {
      const response = await fetch('/api/admin/billing/plans', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pending.current.id }, body: payload });
      const result = await response.json();
      if (!response.ok) { setError(result.error || t('saveFailed')); return; }
      pending.current = null; setSuccess(t('saved', { version: result.plan.version })); router.refresh();
    } catch { setError(t('networkError')); } finally { setBusy(false); }
  }
  return <section className="admin-section" aria-labelledby="billing-plans-heading">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="billing-plans-heading">{t('title')}</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('intro')}</p></div>
      <button type="button" className="button button-primary" onClick={() => { setDraft({ ...emptyDraft(), effectiveAt: dateInput(new Date().toISOString()) }); setOpen(true); setError(''); setSuccess(''); pending.current = null; }}>{t('newPlan')}</button></div>
    <p className="admin-footnote mt-3">{t('mode', { mode })}</p>
    {plans.length ? <div className="admin-table-wrap mt-4" role="region" aria-label={t('title')} tabIndex={0}><table className="admin-table"><thead><tr><th>{t('plan')}</th><th>{t('kind')}</th><th>{t('price')}</th><th>{t('credits')}</th><th>{t('state')}</th><th>{t('effective')}</th><th>{t('actions')}</th></tr></thead><tbody>{plans.map(plan => <tr key={plan.id}><td><strong>{locale === 'cs' ? plan.nameCs : plan.nameEn}</strong><small>{plan.code} · v{plan.version}</small></td><td>{t(plan.kind)}</td><td>{new Intl.NumberFormat(locale === 'cs' ? 'cs-CZ' : 'en-GB', { style: 'currency', currency: plan.currency }).format(Number(plan.amountMinor) / 100)}</td><td>{plan.kind === 'MONTHLY' ? plan.monthlyCredits : plan.packCredits}</td><td>{plan.isVisible ? t('visible') : t('hidden')} · {plan.isPurchasable ? t('purchasable') : t('notPurchasable')}</td><td>{new Date(plan.effectiveAt).toLocaleString(locale === 'cs' ? 'cs-CZ' : 'en-GB')}</td><td><button type="button" className="min-h-11 text-sm font-semibold text-teal-700 underline dark:text-teal-300" onClick={() => edit(plan)}>{t('newVersion')}</button></td></tr>)}</tbody></table></div> : <p className="admin-empty">{t('empty')}</p>}
    {open && <form onSubmit={save} className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900" aria-label={t('editor')}>
      <h3 className="text-lg font-semibold">{t('editor')}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('immutable')}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {textField('code', t('code'), true)}
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{t('kind')}<select value={draft.kind} onChange={event => { const kind = event.target.value as Draft['kind']; setDraft(current => ({ ...current, kind, amount: kind === 'FREE' ? '0.00' : current.amount, monthlyCredits: kind === 'MONTHLY' ? current.monthlyCredits : 0, packCredits: kind === 'CREDIT_PACK' ? current.packCredits : 0, isPurchasable: kind === 'FREE' ? false : current.isPurchasable })); }} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><option value="FREE">{t('FREE')}</option><option value="MONTHLY">{t('MONTHLY')}</option><option value="CREDIT_PACK">{t('CREDIT_PACK')}</option></select></label>
        {textField('nameCs', t('nameCs'), true)}{textField('nameEn', t('nameEn'), true)}
        {textField('descriptionCs', t('descriptionCs'))}{textField('descriptionEn', t('descriptionEn'))}
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{t('currency')}<select value={draft.currency} onChange={event => setDraft(current => ({ ...current, currency: event.target.value as Draft['currency'] }))} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><option>CZK</option><option>EUR</option><option>USD</option></select></label>
        {textField('amount', t('amount'), true)}{draft.kind === 'MONTHLY' && textField('monthlyCredits', t('monthlyCredits'))}{draft.kind === 'CREDIT_PACK' && textField('packCredits', t('packCredits'))}{textField('sortOrder', t('sortOrder'))}
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{t('effective')}<input type="datetime-local" required value={draft.effectiveAt} onChange={event => setDraft(current => ({ ...current, effectiveAt: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"/></label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">{t('retired')}<input type="datetime-local" value={draft.retiredAt} onChange={event => setDraft(current => ({ ...current, retiredAt: event.target.value }))} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"/></label>
        <details className="rounded-md border border-slate-200 p-3 dark:border-slate-700 sm:col-span-2"><summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-100">{t('stripeMappings')}</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{textField('stripeTestProductId', t('testProduct'))}{textField('stripeTestPriceId', t('testPrice'))}{textField('stripeLiveProductId', t('liveProduct'))}{textField('stripeLivePriceId', t('livePrice'))}</div></details>
      </div>
      <div className="mt-4 flex flex-wrap gap-6"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.isVisible} onChange={event => setDraft(current => ({ ...current, isVisible: event.target.checked }))}/>{t('visible')}</label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.isPurchasable} onChange={event => setDraft(current => ({ ...current, isPurchasable: event.target.checked }))}/>{t('purchasable')}</label></div>
      <div className="mt-4">{textField('reason', t('reason'), true)}</div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}{success && <p role="status" className="mt-3 text-sm text-teal-700 dark:text-teal-300">{success}</p>}
      <div className="mt-5 flex flex-wrap gap-3"><button type="submit" disabled={busy} className="button button-primary">{busy ? t('saving') : t('publish')}</button><button type="button" disabled={busy} className="button button-secondary" onClick={() => setOpen(false)}>{t('cancel')}</button></div>
    </form>}
  </section>;
}
