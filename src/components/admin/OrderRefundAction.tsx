'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OrderRefundAction({ targetId, targetKind, mode, locale }: { targetId: string; targetKind: 'order' | 'invoice'; mode: 'test' | 'live'; locale: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const cs = locale === 'cs';
  async function submit() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/billing/refund', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, targetKind, mode, reason }),
      });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || (cs ? 'Vrácení selhalo.' : 'Refund failed.')); return; }
      setMessage(cs ? 'Vrácení odesláno Stripe. Stav a kredity se aktualizují po webhooku.' : 'Refund submitted to Stripe. Status and credits update after the webhook.');
      setOpen(false); router.refresh();
    } catch { setMessage(cs ? 'Služba není dostupná.' : 'Service unavailable.'); }
    finally { setBusy(false); }
  }
  return <div className="min-w-40">
    {!open && <button type="button" className="text-sm font-semibold text-rose-700 underline dark:text-rose-300" onClick={() => setOpen(true)}>{cs ? 'Vrátit platbu' : 'Refund payment'}</button>}
    {open && <div className="space-y-2">
      <label className="block text-xs">{cs ? 'Důvod vrácení' : 'Refund reason'}
        <input className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100" value={reason} onChange={event => setReason(event.target.value)} maxLength={300} minLength={5} required/>
      </label>
      <p className="text-xs text-slate-600 dark:text-slate-300">{mode === 'live' ? (cs ? 'Skutečná platba. Akce je nevratná.' : 'Real payment. This action cannot be undone.') : (cs ? 'Testovací platba.' : 'Test payment.')}</p>
      <div className="flex gap-2"><button type="button" disabled={busy || reason.trim().length < 5} onClick={submit} className="rounded-md bg-rose-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">{busy ? '…' : (cs ? 'Potvrdit vrácení' : 'Confirm refund')}</button><button type="button" disabled={busy} onClick={() => setOpen(false)} className="text-xs underline">{cs ? 'Zrušit' : 'Cancel'}</button></div>
    </div>}
    {message && <p role="status" className="mt-1 text-xs">{message}</p>}
  </div>;
}
