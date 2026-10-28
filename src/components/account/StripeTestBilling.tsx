'use client';
import { useState } from 'react';

type Subscription = { status: string; cancelAtPeriodEnd: boolean } | null;
export function StripeTestBilling({ enabled, credits, subscription }: { enabled: boolean; credits: number; subscription: Subscription }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function open(kind: 'checkout' | 'portal') {
    setBusy(true); setError('');
    try {
      let requestId = '';
      if (kind === 'checkout') {
        const current = sessionStorage.getItem('overto-test-checkout');
        const saved = current ? JSON.parse(current) as { id?: string; at?: number } : null;
        if (saved?.id && saved.at && Date.now() - saved.at < 3600000) requestId = saved.id;
        else { requestId = crypto.randomUUID(); sessionStorage.setItem('overto-test-checkout', JSON.stringify({ id: requestId, at: Date.now() })); }
      }
      const response = await fetch(`/api/local/stripe/${kind}`, { method: 'POST', headers: kind === 'checkout' ? { 'Idempotency-Key': requestId } : {} });
      const data = await response.json(); if (!response.ok) { setError(data.error || 'Fakturaci se nepodařilo otevřít.'); return; }
      const destination = new URL(data.url); const allowed = kind === 'checkout' ? 'checkout.stripe.com' : 'billing.stripe.com';
      if (destination.protocol !== 'https:' || destination.hostname !== allowed) throw new Error('INVALID_DESTINATION');
      window.location.assign(destination.href);
    } catch { setError('Testovací fakturaci se nepodařilo otevřít.'); } finally { setBusy(false); }
  }
  return <><h2 className="text-lg font-semibold">Stripe Test Mode</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">Experimentální integrace pro místní testování. Používá pouze testovací účet Stripe a testovací platební údaje; není určena k reálnému účtování. Výsledek a kredity potvrzuje webhook, ne návrat z platební stránky.</p><p className="mt-4 text-sm font-semibold text-slate-800">Stav: {enabled ? 'konfigurace povolena — experimentální test' : 'není nakonfigurováno nebo je vypnuto'}</p>{enabled && <p className="mt-2 text-sm text-slate-700">Testovací měsíční příděl: {credits} kreditů. Cenu zobrazuje Stripe na testovací platební stránce.</p>}<p className="mt-2 text-sm text-slate-700">Předplatné podle poslední synchronizace: {subscription ? `${subscription.status}${subscription.cancelAtPeriodEnd ? ' — zrušení na konci období' : ''}` : 'žádná potvrzená synchronizace'}</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={!enabled || busy} onClick={() => open('checkout')} className="min-h-11 rounded-lg bg-teal-800 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Otevírání…' : 'Otevřít testovací platbu'}</button><button type="button" disabled={!enabled || busy} onClick={() => open('portal')} className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold text-slate-800 disabled:opacity-50">Správa testovacího předplatného</button></div>{error && <p role="alert" className="mt-3 text-sm text-rose-800">{error}</p>}</>;
}
