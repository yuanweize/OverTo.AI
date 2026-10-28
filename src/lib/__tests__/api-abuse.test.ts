// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/decision-engine', () => ({ analyzeSuspiciousMessage: vi.fn(async () => ({ riskLevel: 'INSUFFICIENT_EVIDENCE', riskScore: 0, redactedCount: 0, metadata: { ruleMatches: 0, processingTimeMs: 1 } })) }));
import { POST } from '@/app/api/analyze/route';

describe('public analysis process protection', () => {
  it('rejects browser simple requests without a JSON content type', async () => {
    const request = new NextRequest('http://localhost/api/analyze', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ text: 'synthetic', enableLlm: true, aiConsent: true }) });
    expect((await POST(request)).status).toBe(415);
  });
  it('rejects oversized bodies without trusting Content-Length', async () => {
    const request = new NextRequest('http://localhost/api/analyze', { method: 'POST', headers: { 'content-length': '1', 'content-type': 'application/json' }, body: JSON.stringify({ text: 'a'.repeat(40001) }) });
    expect((await POST(request)).status).toBe(413);
  });
  it('responds with a retry time when the process-wide rate budget is exhausted', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    let limited: Response | undefined;
    for (let i = 0; i < 121; i++) {
      const request = new NextRequest('http://localhost/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'synthetic', enableLlm: false }) });
      const response = await POST(request);
      if (response.status === 429) { limited = response; break; }
    }
    expect(limited?.status).toBe(429);
    expect(Number(limited?.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(limited?.headers.get('cache-control')).toBe('no-store');
    log.mockRestore();
  });
});
