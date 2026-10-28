import { describe, expect, it } from 'vitest';
import { analyzeSuspiciousMessage } from '../decision-engine';
import { buildActionGraph } from '@/fraud-engine/action-graph';

describe('evidence-grounded action graph', () => {
  it('only creates evidence spans that point to exact sanitized text', async () => {
    const result = await analyzeSuspiciousMessage('Ahoj mami, mám nové číslo. Pošli mi ihned 20 000 Kč.', false);
    result.evidences.push({ id: 'fake', category: 'IMPERSONATION', severity: 'HIGH', title: 'Invented', description: '', matchedSnippet: 'fabricated' });
    const graph = buildActionGraph(result);
    expect(graph.nodes.some(n => n.label === 'Invented')).toBe(false);
    for (const node of graph.nodes.filter(n => n.span)) expect(result.sanitizedText.slice(node.span!.start, node.span!.end)).toBe(node.span!.text);
    expect(graph.edges.every(edge => graph.nodes.some(n => n.id === edge.to && n.kind === 'EVIDENCE'))).toBe(true);
  });
});
