'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { SiteConfig } from '@/server/config/site-schema';
import type { SiteSnapshot } from '@/server/config/site-repository';
const fields: (keyof SiteConfig)[] = ['siteName', 'descriptionCs', 'descriptionEn', 'logoPath', 'brandColor', 'supportUrl', 'contactEmail', 'announcementCs', 'announcementEn'];
export function SiteSettingsForm({ initial, history }: { initial: SiteSnapshot; history: { version: number; config: SiteConfig; createdAt: string }[] }) {
  const [snapshot, setSnapshot] = useState(initial); const [draft, setDraft] = useState(initial.config); const [busy, setBusy] = useState(false); const [status, setStatus] = useState(''); const [error, setError] = useState('');
  const t = useTranslations('Admin'); const c = useTranslations('Common'); const router = useRouter();
  async function save(config: SiteConfig) {
    setBusy(true); setStatus(''); setError('');
    try {
      const response = await fetch('/api/admin/site', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: snapshot.version, config }) });
      if (!response.ok) { setError(response.status === 409 ? t('conflict') : t('invalid')); return; }
      const saved = await response.json(); setSnapshot(saved); setDraft(saved.config); setStatus(c('saved')); router.refresh();
    } catch { setError(c('saveError')); } finally { setBusy(false); }
  }
  return <div className="grid gap-8 lg:grid-cols-[1fr_260px]"><form onSubmit={event => { event.preventDefault(); void save(draft); }} className="rounded-xl border border-slate-200 bg-white p-6"><p className="mb-6 text-sm leading-6 text-slate-600">{t('safeNote')}</p><div className="grid gap-5 sm:grid-cols-2">{fields.map(key=><label className="block text-sm font-semibold" key={key}>{t(key)}<input value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})} maxLength={key.startsWith('announcement')?300:key==='supportUrl'?500:key==='siteName'?60:240} className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-base"/></label>)}<label className="text-sm font-semibold">{t('defaultLocale')}<select value={draft.defaultLocale} onChange={e=>setDraft({...draft,defaultLocale:e.target.value as 'cs'|'en'})} className="mt-2 block min-h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-3"><option value="cs">Čeština</option><option value="en">English</option></select></label><label className="text-sm font-semibold">{t('defaultTheme')}<select value={draft.defaultTheme} onChange={e=>setDraft({...draft,defaultTheme:e.target.value as SiteConfig['defaultTheme']})} className="mt-2 block min-h-12 w-full rounded-lg border border-slate-300 bg-slate-50 px-3">{['system','light','dark'].map(theme=><option key={theme} value={theme}>{c(theme)}</option>)}</select></label></div><div className="mt-7 flex flex-wrap items-center gap-4"><button disabled={busy} className="button button-primary">{busy?c('saving'):c('save')}</button><span className="text-sm text-slate-600">{t('version')}: {snapshot.version}</span></div>{status&&<p role="status" className="mt-4 text-sm">{status}</p>}{error&&<p role="alert" className="mt-4 text-sm text-rose-800">{error}</p>}</form><aside><h2 className="text-lg font-semibold">{t('audit')}</h2><ol className="mt-4 space-y-4">{history.map(entry=><li key={entry.version} className="border-b border-slate-200 pb-4"><p className="text-sm font-semibold">v{entry.version} · {new Date(entry.createdAt).toISOString().slice(0,16).replace('T',' ')} UTC</p><button type="button" disabled={busy} onClick={()=>{setDraft(entry.config);setStatus('');}} className="text-link text-sm">{t('loadVersion')}</button></li>)}</ol></aside></div>;
}
