'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function AdminUserActions({ userId, userName, userEmail }: { userId: string; userName: string; userEmail: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState('Administrátorské navýšení');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const pending = useRef<{ id: string; payload: string } | null>(null);
  const router = useRouter();
  const t = useTranslations('AdminOps');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess(false);

    try {
      const payload = JSON.stringify({ userId, amount: Number(amount), reason });
      if (!pending.current || pending.current.payload !== payload) pending.current = { id: crypto.randomUUID(), payload };
      const res = await fetch('/api/admin/users/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pending.current.id },
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('creditActionFailed'));
        return;
      }
      setSuccess(true);
      pending.current = null;
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        router.refresh();
      }, 1000);
    } catch {
      setError(t('creditNetworkError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-teal-700 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-200"
      >
        {t('addCredits')}
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby={`credit-dialog-${userId}`} onKeyDown={event => { if (event.key === 'Escape' && !busy) setOpen(false); }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 id={`credit-dialog-${userId}`} className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('addCreditsToUser')}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {userName} ({userEmail})
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t('creditAmount')}
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    className="mt-1 min-h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t('creditReason')}
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="mt-1 min-h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </label>
              </div>

              {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
              {success && <p role="status" className="text-xs font-medium text-teal-600 dark:text-teal-400">{t('creditSuccess')}</p>}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="rounded px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy || amount < 1}
                  className="rounded bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
                >
                  {busy ? t('saving') : t('confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
