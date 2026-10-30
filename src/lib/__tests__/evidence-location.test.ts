import { describe, expect, it } from 'vitest';
import { locateEvidence } from '@/fraud-engine/evidence/locate';
import { buildActionGraph } from '@/fraud-engine/action-graph';
import { analyzeSuspiciousMessage } from '../decision-engine';
describe('evidence location', () => {
  it('enumerates repeated text instead of silently choosing the first occurrence', async () => {
    const result = await analyzeSuspiciousMessage('Pošli peníze. Pošli peníze.');
    result.evidences = [{ id: 'test', category: 'PAYMENT_DEMAND', severity: 'HIGH', title: 'Request', description: 'Synthetic', matchedSnippet: 'Pošli peníze.' }];
    const node = buildActionGraph(result).nodes.find(node => node.kind === 'EVIDENCE')!;
    expect(node.ambiguous).toBe(true);
    expect(node.span).toBeUndefined();
    expect(node.spans).toHaveLength(2);
    expect(node.spans?.map(span => span.start)).toEqual([0,14]);
  });
  it('maps NFC quotations to original decomposed UTF-16 offsets after emoji', () => {
    const text = '📩 Pos\u030cli pene\u0301ze.';
    const { spans } = locateEvidence(text, 'Pošli penéze');
    expect(spans).toHaveLength(1);
    expect(spans[0].start).toBe(3);
    expect(text.slice(spans[0].start,spans[0].end)).toBe(spans[0].text);
    expect(spans[0].text.normalize('NFC')).toBe('Pošli penéze');
  });
  it('does not match part of a grapheme or invent a location', () => {
    expect(locateEvidence('👨‍👩‍👧‍👦', '👨').spans).toHaveLength(0);
    expect(locateEvidence('Zpráva', 'fabricated').spans).toHaveLength(0);
  });
  it('bounds repeated-match output with an explicit truncation flag', () => {
    const result = locateEvidence('x '.repeat(200), 'x');
    expect(result.spans).toHaveLength(128);
    expect(result.truncated).toBe(true);
  });
});
