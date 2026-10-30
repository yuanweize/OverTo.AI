import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAllowedOrigin } from '../origin';

describe('isAllowedOrigin', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects null or empty origin', () => {
    expect(isAllowedOrigin(null, 'http://localhost:3000')).toBe(false);
    expect(isAllowedOrigin('', 'http://localhost:3000')).toBe(false);
  });

  it('accepts exact match', () => {
    expect(isAllowedOrigin('https://overto.cz', 'https://overto.cz')).toBe(true);
    expect(isAllowedOrigin('http://localhost:3006', 'http://localhost:3006')).toBe(true);
  });

  it('rejects cross-origin attacking domains', () => {
    expect(isAllowedOrigin('https://evil.com', 'https://overto.cz')).toBe(false);
    expect(isAllowedOrigin('https://evil.com', 'http://localhost:3006')).toBe(false);
    expect(isAllowedOrigin('http://overto.cz.evil.com', 'https://overto.cz')).toBe(false);
  });

  it('accepts loopback equivalence between localhost and 127.0.0.1 on the same port', () => {
    expect(isAllowedOrigin('http://localhost:3006', 'http://127.0.0.1:3006')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:3006', 'http://localhost:3006')).toBe(true);
    expect(isAllowedOrigin('http://[::1]:3006', 'http://localhost:3006')).toBe(true);
  });

  it('rejects loopback requests with mismatched ports', () => {
    expect(isAllowedOrigin('http://localhost:8000', 'http://127.0.0.1:3006')).toBe(false);
    expect(isAllowedOrigin('http://127.0.0.1:3000', 'http://localhost:3006')).toBe(false);
  });

  it('rejects loopback requests when production canonical origin is configured', () => {
    expect(isAllowedOrigin('http://localhost:3000', 'https://overto.cz')).toBe(false);
    expect(isAllowedOrigin('http://127.0.0.1:3000', 'https://overto.cz')).toBe(false);
  });

  it('falls back to environment variables when configuredUrl is omitted', () => {
    process.env.OVERTO_PUBLIC_URL = 'http://127.0.0.1:3006';
    expect(isAllowedOrigin('http://localhost:3006')).toBe(true);
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
  });
});

