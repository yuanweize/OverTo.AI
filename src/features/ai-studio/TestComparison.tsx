'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
export type PromptTestMetric={id:string;prompt_id:string;model:string;status:string;duration_ms:number;input_tokens:number|null;output_tokens:number|null;failure_reason:string|null;grounded_signals:number|null;rejected_evidence:number|null;created_at:string};
export function TestComparison({tests}: {tests:PromptTestMetric[]}) {
  const t=useTranslations('PromptLab');
  const [left,setLeft]=useState(tests[0]?.id??''),[right,setRight]=useState(tests[1]?.id??'');
  const a=tests.find(x=>x.id===left),b=tests.find(x=>x.id===right);
  const fields: Array<[string,keyof PromptTestMetric]>=[[t('version'),'prompt_id'],['Model','model'],[t('status'),'status'],[t('duration'),'duration_ms'],[t('inputTokens'),'input_tokens'],[t('outputTokens'),'output_tokens'],[t('grounded'),'grounded_signals'],[t('rejected'),'rejected_evidence'],[t('failure'),'failure_reason']];
  const select=(value:string,update:(value:string)=>void,label:string)=><label className="block text-sm font-semibold">{label}<select className="studio-input" value={value} onChange={e=>update(e.target.value)}><option value="">{t('selectTest')}</option>{tests.map(x=><option key={x.id} value={x.id}>{x.created_at} · {x.prompt_id.slice(0,8)} · {x.status}</option>)}</select></label>;
  return <section className="mt-10"><h2 className="text-xl font-semibold">{t('compare')}</h2><p className="muted mt-2 text-sm leading-6">{t('compareNote')}</p>{!tests.length?<p className="muted mt-5">{t('noTests')}</p>:<><div className="mt-5 grid gap-4 md:grid-cols-2">{select(left,setLeft,t('testA'))}{select(right,setRight,t('testB'))}</div><div className="mt-5 overflow-auto"><table className="studio-table"><caption className="sr-only">{t('compare')}</caption><thead><tr><th scope="col">{t('metric')}</th><th scope="col">{t('testA')}</th><th scope="col">{t('testB')}</th></tr></thead><tbody>{fields.map(([label,key])=><tr key={key}><th scope="row">{label}</th><td>{a?.[key]??'—'}</td><td>{b?.[key]??'—'}</td></tr>)}</tbody></table></div></>}</section>;
}
