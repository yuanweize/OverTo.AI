import type { AnalysisResult } from '@/types/analyzer';

export type GraphNodeKind = 'UNKNOWN_SENDER' | 'CLAIMED_IDENTITY' | 'REQUESTED_ACTION' | 'RISK_SIGNAL' | 'EVIDENCE';
export interface GraphNode { id: string; kind: GraphNodeKind; label: string; source: 'SYSTEM' | 'RULES' | 'AI'; span?: { start: number; end: number; text: string } }
export interface GraphEdge { from: string; to: string; relation: 'REFERENCES_EVIDENCE' }
export interface ActionGraph { version: '1'; nodes: GraphNode[]; edges: GraphEdge[]; limitations: string[] }

/** Spans refer to UTF-16 offsets in the sanitized response text. Only exact matches are used. */
export function buildActionGraph(result: AnalysisResult): ActionGraph {
  const text = result.sanitizedText;
  const nodes: GraphNode[] = [{ id: 'sender', kind: 'UNKNOWN_SENDER', label: 'Odesílatel není ověřen', source: 'SYSTEM' }];
  const edges: GraphEdge[] = [];
  const addGrounded = (kind: GraphNodeKind, label: string, quote: string | undefined, source: 'RULES' | 'AI') => {
    if (!quote) return;
    const start = text.indexOf(quote);
    if (start < 0 || quote.length === 0) return;
    const index = nodes.length;
    const id = `node-${index}`, evidenceId = `evidence-${index}`;
    nodes.push({ id, kind, label, source });
    nodes.push({ id: evidenceId, kind: 'EVIDENCE', label: 'Úryvek ze zprávy', source, span: { start, end: start + quote.length, text: quote } });
    edges.push({ from: id, to: evidenceId, relation: 'REFERENCES_EVIDENCE' });
  };
  if (result.semanticAnalysis?.claimedIdentity) addGrounded('CLAIMED_IDENTITY', 'Možná uvedená identita', result.semanticAnalysis.claimedIdentity, 'AI');
  for (const action of result.semanticAnalysis?.requestedActions ?? []) addGrounded('REQUESTED_ACTION', action.description, action.evidenceText, 'AI');
  for (const signal of result.evidences) addGrounded('RISK_SIGNAL', signal.title, signal.matchedSnippet, signal.id.startsWith('LLM_') ? 'AI' : 'RULES');
  return { version: '1', nodes, edges, limitations: ['Vazby pouze propojují možné signály a přesné úryvky; neprokazují totožnost, úmysl ani podvod.', 'Úryvky se vztahují k upravenému textu. Opakovaný text se lokalizuje na první výskyt.'] };
}
