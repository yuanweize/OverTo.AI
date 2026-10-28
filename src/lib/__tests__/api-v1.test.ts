// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/analyses/route';

describe('v1 analysis API', () => {
  it('returns a non-persistent versioned result and grounded graph', async () => {
    const request = new NextRequest('http://localhost/api/v1/analyses', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Ahoj mami, mám nové číslo. Pošli mi ihned 20 000 Kč.' }) });
    const response = await POST(request), body = await response.json();
    expect(response.status).toBe(200);
    expect(body.schemaVersion).toBe('1.0');
    expect(body.analysisId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.engine.mode).toBe('DETERMINISTIC_RULES');
    for (const node of body.actionGraph.nodes.filter((item: { span?: unknown }) => item.span)) expect(body.result.sanitizedText.slice(node.span.start, node.span.end)).toBe(node.span.text);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('preserves consent and input validation errors', async () => {
    const req = new NextRequest('http://localhost/api/v1/analyses', { method: 'POST', body: JSON.stringify({ text: 'test', enableLlm: true }) });
    expect((await POST(req)).status).toBe(400);
  });
});
