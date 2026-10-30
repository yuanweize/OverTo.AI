'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function CreateProject() {
  const t = useTranslations('Account');
  const [name, setName] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setBusy(true); setError(''); try { const response = await fetch('/api/local/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); const result = await response.json(); if (!response.ok) { setError(result.error || t('createError')); return; } setName(''); router.refresh(); } catch { setError(t('network')); } finally { setBusy(false); } }
  return <form onSubmit={submit} className="mt-6 max-w-lg"><label htmlFor="project-name" className="text-sm font-semibold">{t('newProjectName')}</label><div className="mt-2 flex flex-wrap gap-2"><input id="project-name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"/><button disabled={busy || !name.trim()} className="min-h-11 rounded-lg bg-teal-800 px-4 font-semibold text-white hover:bg-teal-900 disabled:opacity-50">{busy ? t('creating') : t('createProject')}</button></div>{error && <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p>}</form>;
}
