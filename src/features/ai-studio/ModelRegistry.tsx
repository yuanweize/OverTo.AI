'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import type { ProviderSettings } from '@/ai/providers-config';

export function ModelRegistry({ initial }: { initial: { version: number; config: ProviderSettings } }) {
  const t = useTranslations('Models');
  const [config, setConfig] = useState(initial.config);
  const [version, setVersion] = useState(initial.version);
  const [candidate, setCandidate] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  function add(event: React.FormEvent) {
    event.preventDefault();
    const model = candidate.trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(model) || config.allowedModels.includes(model) || config.allowedModels.length >= 30) { setMessage(t('invalid')); return; }
    setConfig({ ...config, allowedModels: [...config.allowedModels, model] }); setCandidate(''); setMessage('');
  }
  async function save() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/ai-studio/providers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version, config }) });
      const body = await response.json();
      if (!response.ok) { setMessage(response.status === 409 ? t('conflict') : t('error')); return; }
      setVersion(body.version); setConfig(body.config); setMessage(t('saved'));
    } catch { setMessage(t('error')); }
    finally { setBusy(false); }
  }
  return <div className="model-registry"><div className="model-registry-head"><div><h2>{t('registered')}</h2><p>{t('provider')}: {config.providerName}</p></div><span className="project-count">{config.allowedModels.length}</span></div><ul className="model-list">{config.allowedModels.map(model => <li key={model}><label className="model-choice"><input type="radio" name="default-model" checked={config.model === model} onChange={() => setConfig({ ...config, model })}/><span><strong>{model}</strong><small>{config.model === model ? t('default') : t('available')}</small></span></label><button type="button" className="model-remove" disabled={busy || config.model === model} onClick={() => setConfig({ ...config, allowedModels: config.allowedModels.filter(x => x !== model) })} aria-label={`${t('remove')} ${model}`} title={config.model === model ? t('cannotRemoveDefault') : t('remove')}><Trash2 size={17} aria-hidden="true"/></button></li>)}</ul><form onSubmit={add} className="model-add"><label htmlFor="model-id">{t('modelId')}</label><div><input id="model-id" className="studio-input" value={candidate} maxLength={120} onChange={event => setCandidate(event.target.value)} placeholder="provider/model-id"/><button className="button button-secondary" type="submit"><Plus size={17} aria-hidden="true"/>{t('add')}</button></div></form><div className="model-footer"><p>{t('note')}</p><button type="button" disabled={busy} onClick={save} className="button button-primary">{busy ? t('saving') : t('save')}</button></div>{message && <p role="status" className="mt-4 text-sm">{message}</p>}</div>;
}
