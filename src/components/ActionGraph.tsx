import React from 'react';
import type { ActionGraph as Graph } from '@/fraud-engine/action-graph';

export function ActionGraph({ graph }: { graph: Graph }) {
  const nodes = graph.nodes.filter(n => n.kind !== 'EVIDENCE' && n.kind !== 'UNKNOWN_SENDER');
  return <section aria-labelledby="action-graph-title" className="border-b border-slate-200 p-5 sm:p-8">
    <h3 id="action-graph-title" className="text-xl font-bold text-slate-900">Jaké souvislosti vidíme</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">Odesílatel není ověřen. Každý uvedený signál odkazuje na konkrétní úryvek upravené zprávy.</p>
    {nodes.length === 0 ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">Pro vztahovou mapu nemáme dost ověřitelných úryvků.</p> : <ol className="mt-4 space-y-2">{nodes.map(node => { const edge = graph.edges.find(e => e.from === node.id); const evidence = graph.nodes.find(n => n.id === edge?.to); return <li key={node.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{node.label}</span><span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">{node.source === 'AI' ? 'AI' : 'Pravidla'}</span></div>{evidence?.span && <details className="mt-2"><summary className="cursor-pointer text-sm font-semibold text-teal-800 underline underline-offset-4">Zobrazit úryvek</summary><blockquote className="mt-2 break-words border-l-2 border-teal-600 pl-3 text-sm leading-6 text-slate-700">„{evidence.span.text}“</blockquote></details>}</li>; })}</ol>}
    <p className="mt-4 text-sm leading-6 text-slate-600">{graph.limitations[0]}</p>
  </section>;
}
