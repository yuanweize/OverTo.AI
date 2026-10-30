import { describe, expect, it } from 'vitest';
import { analyzeSuspiciousMessage } from '../decision-engine';
import { buildActionGraph } from '@/fraud-engine/action-graph';
import { POST } from '@/app/api/analyze/route';
import { NextRequest } from 'next/server';

const text = 'Ahoj mami, mám nové číslo. Pošli mi ihned peníze.';
describe('localized analysis preserves decision and evidence', () => {
  it('changes authored copy without changing quotations, decisions or scores', async () => {
    const cs = await analyzeSuspiciousMessage(text, false, 'cs');
    const en = await analyzeSuspiciousMessage(text, false, 'en');
    expect(en.locale).toBe('en');
    expect(en.summary).toContain('Verify');
    expect(en.headlineCzech).toBe(cs.headlineCzech);
    expect(en.riskLevel).toBe(cs.riskLevel);
    expect(en.riskScore).toBe(cs.riskScore);
    expect(en.evidences.map(e => [e.id, e.matchedSnippet, e.severity])).toEqual(cs.evidences.map(e => [e.id, e.matchedSnippet, e.severity]));
    expect(en.recommendedActions.map(a => a.id)).toEqual(cs.recommendedActions.map(a => a.id));
    expect(en.recommendedActions[0].action).toContain('Call your relative');
    for (const node of buildActionGraph(en).nodes) if (node.span) expect(en.sanitizedText.slice(node.span.start, node.span.end)).toBe(node.span.text);
  });
  it('negotiates English but gives explicit Czech priority', async () => {
    for (const locale of [undefined, 'cs']) {
      const response = await POST(new NextRequest('http://localhost/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en-GB' }, body: JSON.stringify({ text, enableLlm: false, locale }) }));
      expect(response.status).toBe(200);
      expect((await response.json()).locale).toBe(locale || 'en');
    }
  });
  it('rejects unsupported explicit locale', async () => {
    const response = await POST(new NextRequest('http://localhost/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, locale: 'xx' }) }));
    expect(response.status).toBe(400);
  });
});
