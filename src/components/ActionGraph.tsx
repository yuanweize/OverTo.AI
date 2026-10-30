'use client';
import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { ActionGraph as Graph } from '@/fraud-engine/action-graph';

export function ActionGraph({ graph, text }: { graph: Graph; text?: string }) {
  const t = useTranslations('Graph');
  const [focused, setFocused] = useState<{ id: string; index: number } | null>(null);
  const excerpt = useRef<HTMLParagraphElement>(null);
  const nodes = graph.nodes.filter(n => n.kind !== 'EVIDENCE' && n.kind !== 'UNKNOWN_SENDER');
  const selected = graph.nodes.find(n => n.id === focused?.id)?.spans?.[focused?.index ?? 0];
  return <section aria-labelledby="action-graph-title" className="border-b border-slate-200 p-5 sm:p-8">
    <h3 id="action-graph-title" className="text-xl font-bold text-slate-900">{t('title')}</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">{t('notice')}</p>
    <div className="evidence-explorer">
    {nodes.length === 0 ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">{t('empty')}</p> : <ol className="mt-4 space-y-2 evidence-signals">{nodes.map(node => {
      const edge = graph.edges.find(e => e.from === node.id);
      const evidence = graph.nodes.find(n => n.id === edge?.to);
      return <li key={node.id} className="rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{node.label}</span><span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">{node.source === 'AI' ? 'AI' : t('rules')}</span></div>
        {node.description && <p className="muted mt-2 text-sm leading-6">{node.description}</p>}
        {!!evidence?.spans?.length && <><blockquote className="mt-2 break-words border-l-2 border-teal-600 pl-3 text-sm leading-6 text-slate-700">„{evidence.spans[0].text}“</blockquote>{evidence.ambiguous && <p className="muted mt-2 text-sm">{t('ambiguous', { count: evidence.spans.length })}</p>}{evidence.truncated && <p className="muted text-sm">{t('truncated')}</p>}{text !== undefined && <div className="flex flex-wrap gap-2">{evidence.spans.map((span,index) => <button key={span.start} type="button" aria-pressed={focused?.id === evidence.id && focused.index === index} onClick={() => { setFocused({id:evidence.id,index}); excerpt.current?.focus(); }} className="text-link mt-2 inline-flex items-center text-sm">{evidence.spans!.length === 1 ? t('locate') : t('occurrence', { number: index + 1 })}</button>)}</div>}</>}
      </li>;
    })}</ol>}
    {text !== undefined && <div className="mt-5 evidence-source"><h4 className="font-semibold">{t('source')}</h4><p ref={excerpt} tabIndex={-1} aria-label={t('source')} className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7">{selected ? <>{text.slice(0, selected.start)}<mark className="bg-amber-100 text-amber-950">{text.slice(selected.start, selected.end)}</mark>{text.slice(selected.end)}</> : text}</p><p role="status" className="muted mt-2 text-sm">{selected ? t('selected') : t('select')}</p></div>}
    </div><p className="mt-4 text-sm leading-6 text-slate-600">{t('limitations')}</p>
  </section>;
}
