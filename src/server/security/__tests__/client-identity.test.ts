import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractClientIdentifier, getClientIdentitySalt } from '../client-identity';
import { NextRequest } from 'next/server';

function createMockRequest(headers: Record<string, string>, ip?: string): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/analyze', {
    headers: new Headers(headers),
  });
  if (ip) {
    Object.defineProperty(req, 'ip', { value: ip });
  }
  return req;
}

describe('client identity & trusted proxy protection', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Direct access spoofing resistance (OVERTO_TRUST_PROXY=false)', () => {
    it('ignores spoofed X-Forwarded-For and yields identical hash across rotating IPs', () => {
      vi.stubEnv('OVERTO_TRUST_PROXY', 'false');
      vi.stubEnv('OVERTO_RATE_LIMIT_SALT', 'test-salt-secret-123');

      const req1 = createMockRequest({ 'x-forwarded-for': '198.51.100.1' });
      const req2 = createMockRequest({ 'x-forwarded-for': '198.51.100.2' });
      const req3 = createMockRequest({ 'x-forwarded-for': '203.0.113.99' });

      const id1 = extractClientIdentifier(req1);
      const id2 = extractClientIdentifier(req2);
      const id3 = extractClientIdentifier(req3);

      // Rotating X-Forwarded-For must NOT grant new quotas
      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
    });

    it('ignores spoofed CF-Connecting-IP and X-Real-IP under direct access', () => {
      vi.stubEnv('OVERTO_TRUST_PROXY', 'false');
      vi.stubEnv('OVERTO_RATE_LIMIT_SALT', 'test-salt-secret-123');

      const reqCf = createMockRequest({ 'cf-connecting-ip': '1.1.1.1' });
      const reqReal = createMockRequest({ 'x-real-ip': '2.2.2.2' });
      const reqEmpty = createMockRequest({});

      const idCf = extractClientIdentifier(reqCf);
      const idReal = extractClientIdentifier(reqReal);
      const idEmpty = extractClientIdentifier(reqEmpty);

      expect(idCf).toBe(idEmpty);
      expect(idReal).toBe(idEmpty);
    });

    it('ignores rotating User-Agent headers and groups into same shared untrusted bucket', () => {
      vi.stubEnv('OVERTO_TRUST_PROXY', 'false');
      vi.stubEnv('OVERTO_RATE_LIMIT_SALT', 'test-salt-secret-123');

      const reqUa1 = createMockRequest({ 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
      const reqUa2 = createMockRequest({ 'user-agent': 'curl/7.88.1' });
      const reqUa3 = createMockRequest({ 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' });

      const id1 = extractClientIdentifier(reqUa1);
      const id2 = extractClientIdentifier(reqUa2);
      const id3 = extractClientIdentifier(reqUa3);

      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
    });
  });

  describe('Trusted proxy behavior (OVERTO_TRUST_PROXY=true)', () => {
    it('accepts sanitized client IP when incoming peer is a verified trusted proxy', () => {
      vi.stubEnv('OVERTO_TRUST_PROXY', 'true');
      vi.stubEnv('OVERTO_TRUSTED_PROXIES', '127.0.0.1,loopback,10.0.0.1');
      vi.stubEnv('OVERTO_RATE_LIMIT_SALT', 'test-salt-secret-123');

      const req1 = createMockRequest({ 'x-forwarded-for': '198.51.100.42, 127.0.0.1' }, '127.0.0.1');
      const req2 = createMockRequest({ 'x-forwarded-for': '203.0.113.88, 127.0.0.1' }, '127.0.0.1');

      const id1 = extractClientIdentifier(req1);
      const id2 = extractClientIdentifier(req2);

      // Legitimate distinct clients behind trusted proxy receive distinct hashes
      expect(id1).not.toBe(id2);
      expect(id1).toHaveLength(32);
      expect(id2).toHaveLength(32);
    });

    it('rejects proxy headers if the immediate peer socket IP is untrusted', () => {
      vi.stubEnv('OVERTO_TRUST_PROXY', 'true');
      vi.stubEnv('OVERTO_TRUSTED_PROXIES', '10.0.0.1');
      vi.stubEnv('OVERTO_RATE_LIMIT_SALT', 'test-salt-secret-123');

      // Attacker connecting directly from 198.51.100.99 sends fake X-Forwarded-For
      const reqAttacker1 = createMockRequest({ 'x-forwarded-for': '1.1.1.1' }, '198.51.100.99');
      const reqAttacker2 = createMockRequest({ 'x-forwarded-for': '2.2.2.2' }, '198.51.100.99');

      const id1 = extractClientIdentifier(reqAttacker1);
      const id2 = extractClientIdentifier(reqAttacker2);

      // Since peer 198.51.100.99 is not in OVERTO_TRUSTED_PROXIES, headers are disregarded and socket IP is used!
      expect(id1).toBe(id2);
    });

    it('accepts CF-Connecting-IP when peer is trusted proxy', () => {
      vi.stubEnv('OVERTO_TRUST_PROXY', 'true');
      vi.stubEnv('OVERTO_RATE_LIMIT_SALT', 'test-salt-secret-123');

      const req = createMockRequest({ 'cf-connecting-ip': '198.51.100.77' });
      const id = extractClientIdentifier(req);
      expect(id).toHaveLength(32);
    });
  });

  describe('Production salt security gate', () => {
    it('throws in production if salt is completely unconfigured', () => {
      vi.stubEnv('NODE_ENV', 'production');
      delete process.env.OVERTO_RATE_LIMIT_SALT;
      delete process.env.OVERTO_AUTH_SECRET;

      expect(() => getClientIdentitySalt()).toThrow(
        'OVERTO_RATE_LIMIT_SALT or OVERTO_AUTH_SECRET must be configured in production'
      );
    });

    it('succeeds in production when OVERTO_RATE_LIMIT_SALT is set', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('OVERTO_RATE_LIMIT_SALT', 'custom-production-salt-98765');

      expect(getClientIdentitySalt()).toBe('custom-production-salt-98765');
    });
  });
});
