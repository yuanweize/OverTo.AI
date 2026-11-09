'use client';
import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

type Plan = { id: string; name: string; kind: 'MONTHLY' | 'CREDIT_PACK'; amount: string; currency: string; credits: number };
type Order = { id: string; status: string; amount: string; currency: string; createdAt: string; name: string };
type Invoice = { id: string; status: string; amount: string; currency: string; createdAt: string; url: string | null };

export function CommercialBilling({ mode, locale, checkoutEnabled, plans, orders, invoices, subscription }: {
  mode: 'test' | 'live'; locale: string; checkoutEnabled: boolean; plans: Plan[]; orders: Order[]; invoices: Invoice[];
  subscription: { status: string; cancelAtPeriodEnd: boolean } | null;
}) {
  const t = useTranslations('CommercialBilling');
  const router = useRouter();
  const pending = useRef<{ planId: string; key: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const errorText = (code: string) => code === 'SUBSCRIPTION_EXISTS' ? t('existingSubscription')
    : code === 'CHECKOUT_IN_PROGRESS' ? t('checkoutInProgress')
    : code === 'RATE_LIMITED' ? t('rateLimited')
    : code === 'BILLING_UNAVAILABLE' || code === 'PRICE_UNAVAILABLE' || code === 'PRICE_MISMATCH' ? t('unavailable')
    : t('tryAgain');
  const money = (amount: string, currency: string) => new Intl.NumberFormat(locale === 'cs' ? 'cs-CZ' : 'en-GB', { style: 'currency', currency }).format(Number(amount) / 100);
  const safeInvoiceUrl = (value: string | null) => {
    if (!value) return null;
    try { const u = new URL(value); return u.protocol === 'https:' && (u.hostname === 'stripe.com' || u.hostname.endsWith('.stripe.com')) ? value : null; }
    catch { return null; }
  };
  async function openCheckout(planId: string) {
    setBusy(planId); setError('');
    if (pending.current?.planId !== planId) pending.current = { planId, key: crypto.randomUUID() };
    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pending.current.key }, body: JSON.stringify({ planVersionId: planId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'CHECKOUT_FAILED');
      const target = new URL(data.url);
      if (target.protocol !== 'https:' || target.hostname !== 'checkout.stripe.com') throw new Error('INVALID_CHECKOUT');
      window.location.assign(target.href);
    } catch (cause) { setError(errorText(cause instanceof Error ? cause.message : 'CHECKOUT_FAILED')); setBusy(null); }
  }
  async function openPortal() {
    setBusy('portal'); setError('');
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'PORTAL_UNAVAILABLE');
      const target = new URL(data.url);
      if (target.protocol !== 'https:' || target.hostname !== 'billing.stripe.com') throw new Error('INVALID_PORTAL');
      window.location.assign(target.href);
    } catch (cause) { setError(errorText(cause instanceof Error ? cause.message : 'PORTAL_UNAVAILABLE')); setBusy(null); }
  }
  return <div className="space-y-8 text-slate-900 dark:text-slate-100">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-700">
      <div><h2 className="text-xl font-semibold">{t('title')}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{mode === 'test' ? t('testNote') : t('liveNote')}</p></div>
      <button type="button" onClick={() => router.refresh()} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">{t('refresh')}</button>
    </div>
    <section aria-labelledby="billing-subscription"><div className="flex flex-wrap items-center justify-between gap-3"><h3 id="billing-subscription" className="font-semibold">{t('subscription')}</h3><button type="button" disabled={!orders.length || busy !== null} onClick={openPortal} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">{t('manage')}</button></div><p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{subscription ? `${subscription.status}${subscription.cancelAtPeriodEnd ? ` · ${t('cancelsAtPeriodEnd')}` : ''}` : t('none')}</p></section>
    <section aria-labelledby="billing-plans"><h3 id="billing-plans" className="font-semibold">{t('plans')}</h3>{!checkoutEnabled && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('checkoutPaused')}</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2">{plans.map(plan => <div key={plan.id} className="rounded-md border border-slate-200 p-4 dark:border-slate-700"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{plan.name}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('credits', { count: plan.credits })} · {plan.kind === 'MONTHLY' ? t('monthly') : t('pack')}</p></div><p className="whitespace-nowrap font-semibold">{money(plan.amount, plan.currency)}</p></div><button type="button" disabled={!checkoutEnabled || busy !== null || (plan.kind === 'MONTHLY' && !!subscription && ['active','trialing','past_due','unpaid','incomplete'].includes(subscription.status))} onClick={() => openCheckout(plan.id)} className="mt-4 min-h-11 w-full rounded-md bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400">{busy === plan.id ? t('opening') : t('choose')}</button></div>)}</div>{!plans.length && <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t('noPlans')}</p>}</section>
    {error && <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">{t('error')}: {error}</p>}
    <section aria-labelledby="billing-orders"><h3 id="billing-orders" className="font-semibold">{t('orders')}</h3><div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 dark:border-slate-700"><th className="py-2 pr-4">{t('date')}</th><th className="py-2 pr-4">{t('item')}</th><th className="py-2 pr-4">{t('amount')}</th><th className="py-2">{t('status')}</th></tr></thead><tbody>{orders.map(order => <tr key={order.id} className="border-b border-slate-100 dark:border-slate-800"><td className="py-3 pr-4 whitespace-nowrap">{new Date(order.createdAt).toLocaleDateString(locale === 'cs' ? 'cs-CZ' : 'en-GB', { timeZone: 'UTC' })}</td><td className="py-3 pr-4">{order.name}</td><td className="py-3 pr-4 whitespace-nowrap">{money(order.amount, order.currency)}</td><td className="py-3">{order.status}</td></tr>)}</tbody></table>{!orders.length && <p className="py-4 text-sm text-slate-600 dark:text-slate-400">{t('noOrders')}</p>}</div></section>
    <section aria-labelledby="billing-invoices"><h3 id="billing-invoices" className="font-semibold">{t('invoices')}</h3><div className="mt-3 space-y-2">{invoices.map(invoice => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3 text-sm dark:border-slate-800"><span>{new Date(invoice.createdAt).toLocaleDateString(locale === 'cs' ? 'cs-CZ' : 'en-GB', { timeZone: 'UTC' })} · {invoice.status}</span><span>{money(invoice.amount, invoice.currency)}</span>{safeInvoiceUrl(invoice.url) && <a href={safeInvoiceUrl(invoice.url)!} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-800 underline dark:text-teal-300">{t('openInvoice')}</a>}</div>)}{!invoices.length && <p className="text-sm text-slate-600 dark:text-slate-400">{t('noInvoices')}</p>}</div></section>
  </div>;
}
