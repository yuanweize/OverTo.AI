// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extractClientIdentifier } from '../client-identity';
import { SharedRateLimiter } from '../shared-rate-limit';
import { NextRequest } from 'next/server';

const testDbUrl =
  process.env.DATABASE_URL ||
  process.env.SITE_CONFIG_TEST_DATABASE_URL ||
  'postgresql://overto:Wa-tzj_YYF6SA4aCML1uN3_M8pzNuTY17unmIhqyyEtabTdg@127.0.0.1:5432/overto';

describe('HTTP Header spoofing resistance & multi-instance shared rate limiting', () => {
  let control: Pool;
  let pool: Pool;
  const schema = `identity_http_${randomUUID().replaceAll('-', '')}`;

  beforeAll(async () => {
    control = new Pool({ connectionString: testDbUrl });
    await control.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString: testDbUrl, options: `-c search_path=${schema}` });
    const ddl = await readFile('migrations/009_shared_rate_limits.sql', 'utf8');
    await pool.query(ddl);
  });

  afterAll(async () => {
    if (pool) await pool.end().catch(() => {});
    if (control) {
      await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
      await control.end().catch(() => {});
    }
  });

  it('proves that rotating X-Forwarded-For, CF headers, and User-Agents cannot bypass rate limits', async () => {
    vi.stubEnv('OVERTO_TRUST_PROXY', 'false');
    vi.stubEnv('OVERTO_RATE_LIMIT_SALT', 'security-hardening-salt-701');

    const limiter = new SharedRateLimiter(pool);
    const limit = 3; // allow 3 requests per client per window

    const makeRequest = async (headers: Record<string, string>) => {
      const req = new NextRequest('http://localhost:3000/api/analyze', {
        headers: new Headers(headers),
      });
      const clientId = extractClientIdentifier(req);
      return limiter.consume([
        { bucket: `client-test:${clientId}`, limit, windowSeconds: 60 },
      ]);
    };

    // Request 1: attacker sets fake IP 101.0.0.1
    const res1 = await makeRequest({ 'x-forwarded-for': '101.0.0.1', 'user-agent': 'Scraper/1.0' });
    expect(res1.allowed).toBe(true);

    // Request 2: attacker sets fake IP 101.0.0.2
    const res2 = await makeRequest({ 'x-forwarded-for': '101.0.0.2', 'user-agent': 'Scraper/2.0' });
    expect(res2.allowed).toBe(true);

    // Request 3: attacker rotates Cloudflare header
    const res3 = await makeRequest({ 'cf-connecting-ip': '203.0.113.50', 'user-agent': 'Chrome/120' });
    expect(res3.allowed).toBe(true);

    // Request 4: attacker tries yet another IP — MUST BE BLOCKED!
    const res4 = await makeRequest({ 'x-forwarded-for': '198.51.100.99', 'user-agent': 'Firefox/115' });
    expect(res4.allowed).toBe(false);
    if (!res4.allowed) {
      expect(res4.retryAfter).toBeGreaterThan(0);
    }

    // Request 5: attacker rotates both CF and X-Real-IP and UA — STILL BLOCKED!
    const res5 = await makeRequest({
      'cf-connecting-ip': '1.2.3.4',
      'x-real-ip': '5.6.7.8',
      'user-agent': 'Python-requests/2.28',
    });
    expect(res5.allowed).toBe(false);
  });

  it('proves multi-instance concurrency across independent limiter instances sharing the database', async () => {
    vi.stubEnv('OVERTO_TRUST_PROXY', 'false');
    vi.stubEnv('OVERTO_RATE_LIMIT_SALT', 'security-hardening-salt-701');

    // Instance A and Instance B connecting to the same PostgreSQL
    const limiterA = new SharedRateLimiter(pool);
    const limiterB = new SharedRateLimiter(pool);

    const limit = 5;
    const bucket = `shared-concurrency-${randomUUID()}`;

    // Send 10 concurrent requests across both instances
    const promises = Array.from({ length: 10 }).map((_, i) => {
      const instance = i % 2 === 0 ? limiterA : limiterB;
      return instance.consume([{ bucket, limit, windowSeconds: 60 }]);
    });

    const results = await Promise.all(promises);
    const allowed = results.filter(r => r.allowed);
    const blocked = results.filter(r => !r.allowed);

    expect(allowed.length).toBe(limit);
    expect(blocked.length).toBe(5);
  });
});
