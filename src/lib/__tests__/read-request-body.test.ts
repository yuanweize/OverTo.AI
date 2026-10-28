// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readRequestBody } from '../read-request-body';

describe('bounded request body', () => {
  it('reads bounded content and rejects oversized input', async () => {
    expect(new TextDecoder().decode(await readRequestBody(new Request('http://localhost', { method: 'POST', body: 'abc' }), 3))).toBe('abc');
    await expect(readRequestBody(new Request('http://localhost', { method: 'POST', body: 'abcd' }), 3)).rejects.toThrow('BODY_TOO_LARGE');
  });
  it('times out a stalled request stream', async () => {
    const body = new ReadableStream<Uint8Array>({ start() {} });
    const request = new Request('http://localhost', { method: 'POST', body, duplex: 'half' } as RequestInit);
    await expect(readRequestBody(request, 40, 20)).rejects.toThrow('BODY_TIMEOUT');
  });
});
