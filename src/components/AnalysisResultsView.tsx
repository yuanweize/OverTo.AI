import { useTranslations } from 'next-intl';
import React from 'react';
import { AnalysisResult } from '@/types/analyzer';
import { buildActionGraph } from '@/fraud-engine/action-graph';
import { locateEvidence } from '@/fraud-engine/evidence/locate';
import { ActionGraph } from './ActionGraph';
import { AlertOctagon, AlertTriangle, Info, Sparkles, ArrowRight } from 'lucide-react';

export const AnalysisResultsView: React.FC<{ result: AnalysisResult }> = ({ result }) => {
  const t = useTranslations('Results');
  const unlocated = result.evidences.filter(e => !e.matchedSnippet || !locateEvidence(result.sanitizedText, e.matchedSnippet).spans.length);
  const high = result.riskLevel === 'HIGH_RISK';
  const verify = result.riskLevel === 'VERIFICATION_RECOMMENDED';
  const status = high ? { label: t('high'), icon: AlertOctagon, style: 'border-rose-200 bg-rose-50 text-rose-950', iconStyle: 'text-rose-700' } : verify ? { label: t('verify'), icon: AlertTriangle, style: 'border-amber-200 bg-amber-50 text-amber-950', iconStyle: 'text-amber-700' } : { label: t('insufficient'), icon: Info, style: 'border-slate-200 bg-slate-50 text-slate-900', iconStyle: 'text-slate-600' };
  const Icon = status.icon;
  const failed = result.metadata.aiStatus !== 'NOT_REQUESTED' && result.metadata.aiStatus !== 'SUCCESS';
  return (
    <article aria-labelledby="result-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_38px_rgba(15,45,55,0.06)]">
      <div className={`border-b p-5 sm:p-8 ${status.style}`}>
        <div className="flex items-start gap-4"><Icon className={`mt-1 h-7 w-7 shrink-0 ${status.iconStyle}`} aria-hidden="true" /><div className="min-w-0"><p className="text-sm font-semibold">{t('title')}</p><h2 id="result-title" tabIndex={-1} className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{status.label}</h2><p className="mt-3 max-w-2xl text-base leading-7">{result.summary || result.summaryCzech}</p></div></div>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium"><span>{result.metadata.engine === 'DETERMINISTIC_RULES' ? t('rules') : `${t('hybrid')}${result.metadata.aiModel ? ` · ${result.metadata.aiModel}` : ''}`}</span><span>{(result.metadata.processingTimeMs / 1000).toFixed(1)} s</span></div>
      </div>
      {failed && <p role="status" className="border-b border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950 sm:px-8">{result.metadata.aiReason === 'rate_limit' ? t('rateLimit') : result.metadata.aiReason === 'timeout' ? t('timeout') : t('unavailable')} {t('fallback')}</p>}
      <ActionGraph graph={buildActionGraph(result)} text={result.sanitizedText} />
      <section className="border-b border-slate-200 p-5 sm:p-8"><h3 className="text-xl font-bold text-slate-900">{t('next')}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{t('independent')}</p><ol className="mt-4 divide-y divide-slate-100">{result.recommendedActions.map(action => <li key={action.step} className="flex gap-3 py-4 first:pt-1"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-900">{action.step}</span><div><p className="font-semibold leading-6 text-slate-900">{action.action}</p><p className="mt-1 text-sm leading-6 text-slate-600">{action.rationale}</p></div></li>)}</ol><a href="#verification-title" className="mt-1 inline-flex min-h-11 items-center gap-2 font-semibold text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">{t('workflow')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></a></section>
      {result.semanticAnalysis && <section aria-labelledby="semantic-title" className="border-b border-slate-200 bg-teal-50/40 p-5 sm:p-8"><h3 id="semantic-title" className="flex items-center gap-2 text-xl font-bold text-slate-900"><Sparkles className="h-5 w-5 text-teal-700" aria-hidden="true" />{t('semantic')}</h3><p className="mt-2 text-sm leading-6 text-slate-700">{t('semanticNotice')}</p>{result.semanticAnalysis.claimedIdentity && <p className="mt-4 text-sm leading-6 text-slate-800"><strong>{t('identity')}</strong> {result.semanticAnalysis.claimedIdentity}</p>}{result.semanticAnalysis.requestedActions.length > 0 && <div className="mt-4"><h4 className="font-semibold text-slate-900">{t('requests')}</h4><ul className="mt-2 space-y-2">{result.semanticAnalysis.requestedActions.map((item, i) => <li key={i} className="text-sm leading-6 text-slate-700">{item.description}: <mark className="rounded bg-amber-100 px-1 text-slate-900">{item.evidenceText}</mark></li>)}</ul></div>}<p className="mt-4 text-sm leading-6 text-slate-600">{result.semanticAnalysis.uncertainty.join(' ')}</p></section>}
      {unlocated.length > 0 && <details className="border-b border-slate-200 p-5 sm:px-8"><summary className="min-h-11 cursor-pointer font-semibold">{t('unlocated')} ({unlocated.length})</summary><p className="muted mt-2 text-sm">{t('unlocatedNote')}</p><ul className="mt-4 space-y-4">{unlocated.map((e,index)=><li key={e.id+index}><h4 className="font-semibold">{e.title}</h4><p className="muted mt-1 text-sm leading-6">{e.description}</p></li>)}</ul></details>}
      {result.metadata.traceId && <details className="border-t border-slate-200 p-5 sm:px-8"><summary className="min-h-11 cursor-pointer font-semibold">{t('technical')}</summary><dl className="mt-3 space-y-3 break-all text-sm"><div><dt>{t('traceId')}</dt><dd>{result.metadata.traceId}</dd></div><div><dt>{t('recorded')}</dt><dd>{result.metadata.traceRecorded ? t('yes') : t('no')}</dd></div><div><dt>{t('tokens')}</dt><dd>{result.metadata.inputTokens ?? t('unknown')} / {result.metadata.outputTokens ?? t('unknown')}</dd></div></dl></details>}
      <p className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-600 sm:px-8">{result.uncertaintyNotice}</p>
    </article>
  );
};
