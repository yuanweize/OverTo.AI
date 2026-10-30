'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
export function EvaluationControl() {
  const t=useTranslations('Evaluations'),router=useRouter();
  const [mode,setMode]=useState('RULES_ONLY'),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function run(){setBusy(true);setMessage('');try{const response=await fetch('/api/admin/ai-studio/evaluations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,consent})});const data=await response.json();setMessage(response.ok?t('saved'):t('error')+' '+data.error);router.refresh();}catch{setMessage(t('error'));}finally{setBusy(false);}}
  return <section className="mt-8 border-y border-slate-200 py-6"><div className="flex flex-wrap items-end gap-4"><label className="text-sm font-semibold">{t('mode')}<select className="studio-input" value={mode} disabled={busy} onChange={e=>{setMode(e.target.value);setConsent(false);}}><option>RULES_ONLY</option><option>LLM_ONLY</option><option>HYBRID_AI</option></select></label><button className="button button-primary" disabled={busy||mode!=='RULES_ONLY'&&!consent} onClick={run}>{busy?t('running'):t('run')}</button></div>{mode!=='RULES_ONLY'&&<label className="mt-4 flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-5" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{t('consent')}</label>}<p className="muted mt-4 text-sm leading-6">{t('limit')}</p>{message&&<p role="status" className="mt-4 text-sm">{message}</p>}</section>;
}
