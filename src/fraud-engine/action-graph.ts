import { locateEvidence, type EvidenceSpan } from './evidence/locate';
import type { AnalysisResult } from '@/types/analyzer';

export type GraphNodeKind = 'UNKNOWN_SENDER' | 'CLAIMED_IDENTITY' | 'REQUESTED_ACTION' | 'RISK_SIGNAL' | 'EVIDENCE';
export interface GraphNode { id: string; kind: GraphNodeKind; label: string; source: 'SYSTEM' | 'RULES' | 'AI'; description?: string; span?: EvidenceSpan; spans?: EvidenceSpan[]; ambiguous?: boolean; truncated?: boolean }
export interface GraphEdge { from: string; to: string; relation: 'REFERENCES_EVIDENCE' }
export interface ActionGraph { version: '2'; nodes: GraphNode[]; edges: GraphEdge[]; limitations: string[] }

/** Spans refer to UTF-16 offsets in the sanitized response text. Only exact matches are used. */
export function buildActionGraph(result: AnalysisResult): ActionGraph {
  const text = result.sanitizedText;
  const en = result.locale === 'en';
  const nodes: GraphNode[] = [{ id: 'sender', kind: 'UNKNOWN_SENDER', label: en ? 'Sender is unverified' : 'Odesílatel není ověřen', source: 'SYSTEM' }];
  const edges: GraphEdge[] = [];
  const addGrounded = (kind: GraphNodeKind, label: string, quote: string | undefined, source: 'RULES' | 'AI', description?: string) => {
    if (!quote) return;
    const { spans, truncated } = locateEvidence(text, quote);
    if (!spans.length) return;
    const index = nodes.length;
    const id = `node-${index}`, evidenceId = `evidence-${index}`;
    nodes.push({ id, kind, label, source, description });
    nodes.push({ id: evidenceId, kind: 'EVIDENCE', label: en ? 'Message excerpt' : 'Úryvek ze zprávy', source, span: spans.length === 1 ? spans[0] : undefined, spans, ambiguous: spans.length > 1, truncated });
    edges.push({ from: id, to: evidenceId, relation: 'REFERENCES_EVIDENCE' });
  };
  if (result.semanticAnalysis?.claimedIdentity) addGrounded('CLAIMED_IDENTITY', en ? 'Possible claimed identity' : 'Možná uvedená identita', result.semanticAnalysis.claimedIdentity, 'AI');
  for (const action of result.semanticAnalysis?.requestedActions ?? []) addGrounded('REQUESTED_ACTION', action.description, action.evidenceText, 'AI');
  for (const signal of result.evidences) addGrounded('RISK_SIGNAL', signal.title, signal.matchedSnippet, signal.id.startsWith('LLM_') ? 'AI' : 'RULES', signal.description);
  return { version: '2', nodes, edges, limitations: en ? ['Connections link possible signals to exact excerpts; they do not prove identity, intent or fraud.', 'Excerpts refer to edited text. Repeated text has multiple candidate locations; the intended occurrence is unknown.'] : ['Vazby pouze propojují možné signály a přesné úryvky; neprokazují totožnost, úmysl ani podvod.', 'Úryvky se vztahují k upravenému textu. Opakovaný text má více možných umístění; zamýšlený výskyt není znám.'] };
}
