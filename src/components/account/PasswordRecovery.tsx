'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/auth/client';

export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const t = useTranslations('Auth');
  const params = useSearchParams(); const token = params.get('token'); const invalid = params.has('error');
  const [value, setValue] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [done, setDone] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = reset ? await authClient.resetPassword({ token: token ?? '', newPassword: value }) : await authClient.requestPasswordReset({ email: value, redirectTo: '/reset-password' });
      if (result.error) { setError(reset ? t('invalidRequest') : t('requestError')); return; }
      setDone(true);
    } catch { setError(t('serverError')); } finally { setBusy(false); }
  }
  if (reset && (!token || invalid)) return <><p className="mt-4 text-slate-700">{t('invalid')}</p><Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-teal-800 underline" href="/forgot-password">{t('requestNew')}</Link></>;
  if (done) return <div role="status" className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4 leading-7 text-teal-950">{reset ? t('resetDone') : t('emailDone')} <Link href={reset ? '/login' : '/verify-email'} className="font-semibold underline">{reset ? t('login') : t('instructions')}</Link></div>;
  return <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-semibold">{reset ? t('newPassword') : t('email')}<input required type={reset ? 'password' : 'email'} minLength={reset ? 10 : undefined} maxLength={reset ? 128 : 254} autoComplete={reset ? 'new-password' : 'email'} value={value} onChange={e => setValue(e.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 px-4 text-base"/></label>{error && <p role="alert" className="text-sm text-rose-800">{error}</p>}<button disabled={busy} className="min-h-12 rounded-lg bg-teal-800 px-5 font-semibold text-white disabled:opacity-50">{busy ? t('busy') : reset ? t('reset') : t('sendLink')}</button></form>;
}
