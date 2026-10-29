'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/auth/client';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const t = useTranslations('Auth');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = mode === 'signup' ? await authClient.signUp.email({ email, password, name, callbackURL: '/login' }) : await authClient.signIn.email({ email, password });
      if (result.error) { setError(t('authError')); return; }
      router.push(mode === 'signup' ? '/verify-email' : '/dashboard'); router.refresh();
    } catch { setError(t('unavailable')); } finally { setBusy(false); }
  }
  const field = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
  return <form onSubmit={submit} className="mt-7 space-y-5">{mode === 'signup' && <label className="block text-sm font-semibold">{t('name')}<input required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={field}/></label>}
    <label className="block text-sm font-semibold">{t('email')}<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={field}/></label>
    <label className="block text-sm font-semibold">{t('password')}<input required type="password" minLength={10} maxLength={128} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className={field}/>{mode === 'signup' && <span className="mt-1 block font-normal text-slate-600">{t('passwordHelp')}</span>}</label>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
    <button disabled={busy} className="min-h-12 w-full rounded-lg bg-teal-800 px-5 font-semibold text-white hover:bg-teal-900 disabled:opacity-60">{busy ? t('busy') : mode === 'signup' ? t('signup') : t('login')}</button>
    {mode === 'login' && <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 underline">{t('forgot')}</Link>}
    <p className="text-sm text-slate-700">{mode === 'signup' ? t('existing') : t('new')} <Link className="font-semibold text-teal-800 underline" href={mode === 'signup' ? '/login' : '/signup'}>{mode === 'signup' ? t('login') : t('signup')}</Link></p>
  </form>;
}
