'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/auth/client';

export function ProfileSettings({ initialName, email }: { initialName: string; email: string }) {
  const t = useTranslations('Account');
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const result = await authClient.updateUser({ name: name.trim() });
      if (result.error) {
        setError(t('profileError'));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(t('network'));
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) throw new Error('EXPORT_FAILED');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overto-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      setError(t('network'));
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(event: React.FormEvent) {
    event.preventDefault();
    if (deleteEmail.trim().toLowerCase() !== email.toLowerCase() || !deletePassword) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmEmail: deleteEmail.trim(),
          password: deletePassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || t('network'));
        return;
      }
      await authClient.signOut();
      router.push('/login');
      router.refresh();
    } catch {
      setDeleteError(t('network'));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <h2 className="text-lg font-semibold">{t('profile')}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{t('profileNote')}</p>

      <form onSubmit={submit} className="mt-5 max-w-lg space-y-4">
        <label className="block text-sm font-semibold">
          {t('name')}
          <input
            required
            maxLength={100}
            value={name}
            onChange={event => { setName(event.target.value); setSaved(false); }}
            autoComplete="name"
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <div>
          <p className="text-sm font-semibold">{t('email')}</p>
          <p className="mt-2 break-all text-sm text-slate-700 dark:text-slate-300">{email}</p>
        </div>
        <button
          disabled={busy || !name.trim()}
          className="min-h-11 rounded-lg bg-teal-800 px-4 font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
        >
          {busy ? t('saving') : t('saveProfile')}
        </button>
        {error && <p role="alert" className="text-sm text-rose-800 dark:text-rose-400">{error}</p>}
        {saved && <p role="status" className="text-sm font-medium text-teal-800 dark:text-teal-400">{t('savedProfile')}</p>}
      </form>

      <div className="mt-10 max-w-lg border-t border-slate-200 pt-8 dark:border-slate-800">
        <h3 className="text-base font-semibold">{t('exportData')}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('exportNote')}</p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="mt-3 min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {exporting ? t('exporting') : t('exportData')}
        </button>
      </div>

      <div className="mt-10 max-w-lg border-t border-rose-200 pt-8 dark:border-rose-900/40">
        <h3 className="text-base font-semibold text-rose-800 dark:text-rose-400">{t('deleteAccount')}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('deleteNote')}</p>
        <form onSubmit={handleDelete} className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            {t('deleteConfirmPrompt')} <span className="font-mono text-xs">{email}</span>
            <input
              type="email"
              value={deleteEmail}
              onChange={e => setDeleteEmail(e.target.value)}
              placeholder={email}
              required
              className="mt-1 min-h-10 w-full rounded-lg border border-rose-300 bg-white px-3 text-sm text-slate-900 dark:border-rose-800 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            {t('deletePasswordPrompt')}
            <input
              type="password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              placeholder="••••••••••••"
              required
              autoComplete="current-password"
              className="mt-1 min-h-10 w-full rounded-lg border border-rose-300 bg-white px-3 text-sm text-slate-900 dark:border-rose-800 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <button
            type="submit"
            disabled={deleteBusy || !deletePassword || deleteEmail.trim().toLowerCase() !== email.toLowerCase()}
            className="min-h-11 rounded-lg bg-rose-700 px-4 font-semibold text-white hover:bg-rose-800 disabled:opacity-40"
          >
            {deleteBusy ? t('deleting') : t('confirmDelete')}
          </button>
          {deleteError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{deleteError}</p>}
        </form>
      </div>
    </>
  );
}
