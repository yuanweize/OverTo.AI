// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/analyze/route';
const request = (body: string) => new NextRequest('http://localhost/api/analyze', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('analysis API', () => {
  it('rejects AI requests without explicit consent', async () => {
    const result = await POST(request(JSON.stringify({ text: 'test', enableLlm: true })));
    expect(result.status).toBe(400);
  });
  it('reports unavailable AI without leaking or failing the rules result', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const result = await POST(request(JSON.stringify({ text: 'Ahoj mami', enableLlm: true, aiConsent: true })));
    const data = await result.json();
    expect(result.status).toBe(200);
    expect(data.metadata.aiStatus).toBe('UNAVAILABLE');
    expect(data.metadata.engine).toBe('DETERMINISTIC_RULES');
  });
  it('rejects malformed JSON and oversized requests', async () => {
    expect((await POST(request('{'))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ text: 'a'.repeat(10001) })))).status).toBe(413);
  });
});
