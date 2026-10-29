'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/auth/client';

export function ProfileSettings({ initialName, email }: { initialName: string; email: string }) {
  const t = useTranslations('Account');
  const [name, setName] = useState(initialName); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false); const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); setSaved(false); try { const result = await authClient.updateUser({ name: name.trim() }); if (result.error) { setError(t('profileError')); return; } setSaved(true); router.refresh(); } catch { setError(t('network')); } finally { setBusy(false); } }
  return <><h2 className="text-lg font-semibold">{t('profile')}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t('profileNote')}</p><form onSubmit={submit} className="mt-5 max-w-lg space-y-4"><label className="block text-sm font-semibold">{t('name')}<input required maxLength={100} value={name} onChange={event => { setName(event.target.value); setSaved(false); }} autoComplete="name" className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3"/></label><div><p className="text-sm font-semibold">{t('email')}</p><p className="mt-2 break-all text-sm text-slate-700">{email}</p></div><button disabled={busy || !name.trim()} className="min-h-11 rounded-lg bg-teal-800 px-4 font-semibold text-white hover:bg-teal-900 disabled:opacity-50">{busy ? t('saving') : t('saveProfile')}</button>{error && <p role="alert" className="text-sm text-rose-800">{error}</p>}{saved && <p role="status" className="text-sm font-medium text-teal-800">{t('savedProfile')}</p>}</form></>;
}
