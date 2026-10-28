'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/auth/client';

export function ProfileSettings({ initialName, email }: { initialName: string; email: string }) {
  const [name, setName] = useState(initialName); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false); const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); setSaved(false); try { const result = await authClient.updateUser({ name: name.trim() }); if (result.error) { setError('Jméno se nepodařilo uložit.'); return; } setSaved(true); router.refresh(); } catch { setError('Server není dostupný.'); } finally { setBusy(false); } }
  return <><h2 className="text-lg font-semibold">Profil</h2><p className="mt-2 text-sm leading-6 text-slate-600">Účet a e-mail platí pouze pro místní test. Změna e-mailu a odstranění účtu zatím nejsou dostupné.</p><form onSubmit={submit} className="mt-5 max-w-lg space-y-4"><label className="block text-sm font-semibold">Jméno<input required maxLength={100} value={name} onChange={event => { setName(event.target.value); setSaved(false); }} autoComplete="name" className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3"/></label><div><p className="text-sm font-semibold">E-mail</p><p className="mt-2 break-all text-sm text-slate-700">{email}</p></div><button disabled={busy || !name.trim()} className="min-h-11 rounded-lg bg-teal-800 px-4 font-semibold text-white hover:bg-teal-900 disabled:opacity-50">{busy ? 'Ukládání…' : 'Uložit profil'}</button>{error && <p role="alert" className="text-sm text-rose-800">{error}</p>}{saved && <p role="status" className="text-sm font-medium text-teal-800">Profil je uložen.</p>}</form></>;
}
