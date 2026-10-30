import { describe, it, expect } from 'vitest';
import { extractClientIdentifier } from '../client-identity';
import { NextRequest } from 'next/server';

describe('client identity extractor', () => {
  it('extracts and hashes IPv4 from cf-connecting-ip', () => {
    const req = new NextRequest('http://127.0.0.1/api/analyze', {
      headers: { 'cf-connecting-ip': '203.0.113.195' },
    });
    const id = extractClientIdentifier(req, 'test-salt');
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('extracts and hashes leftmost IP from x-forwarded-for', () => {
    const req = new NextRequest('http://127.0.0.1/api/analyze', {
      headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' },
    });
    const id1 = extractClientIdentifier(req, 'test-salt');
    const reqSame = new NextRequest('http://127.0.0.1/api/analyze', {
      headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.2' },
    });
    const id2 = extractClientIdentifier(reqSame, 'test-salt');
    expect(id1).toBe(id2);
  });

  it('produces different hashes for different IPs', () => {
    const req1 = new NextRequest('http://127.0.0.1/api/analyze', {
      headers: { 'x-forwarded-for': '198.51.100.4' },
    });
    const req2 = new NextRequest('http://127.0.0.1/api/analyze', {
      headers: { 'x-forwarded-for': '198.51.100.5' },
    });
    expect(extractClientIdentifier(req1, 'test-salt')).not.toBe(extractClientIdentifier(req2, 'test-salt'));
  });

  it('falls back gracefully on missing headers without throwing', () => {
    const req = new NextRequest('http://127.0.0.1/api/analyze');
    const id = extractClientIdentifier(req, 'test-salt');
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});
