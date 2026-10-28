import { describe, it, expect } from 'vitest';
import { analyzeUrls, parseHostname } from '../url-analyzer';

describe('Deterministic URL Security Analyzer', () => {
  it('detects impersonated Czech Post domain with suspicious TLD', () => {
    const text = 'Balíček čeká na https://ceskaposta.cz-sledovani.xyz/doplatek';
    const result = analyzeUrls(text);
    expect(result.hasUrl).toBe(true);
    expect(result.evidences.some(e => e.id === 'IMPERSONATION_CESKAPOSTA')).toBe(true);
    expect(result.suspiciousScore).toBeGreaterThanOrEqual(50);
  });

  it('detects IP address as URL host', () => {
    const text = 'Přihlaste se do banky na http://185.220.101.5/csob';
    const result = analyzeUrls(text);
    expect(result.evidences.some(e => e.id === 'URL_IP_ADDRESS')).toBe(true);
    expect(result.evidences.some(e => e.severity === 'CRITICAL')).toBe(true);
  });

  it('detects homoglyphs (Cyrillic mimicking Latin)', () => {
    // U+0430 is cyrillic 'а' in 'postа.cz'
    const text = 'Sledovani: http://post\u0430.cz/info';
    const result = analyzeUrls(text);
    expect(result.evidences.some(e => e.id === 'URL_HOMOGLYPH_CHAR')).toBe(true);
  });

  it('detects URL shorteners', () => {
    const text = 'Vyzvedněte si výhru zde: https://bit.ly/3xFakeScam';
    const result = analyzeUrls(text);
    expect(result.evidences.some(e => e.id === 'URL_SHORTENER')).toBe(true);
    expect(result.evidences.some(e => e.severity === 'HIGH')).toBe(true);
  });

  it('recognizes legitimate domains without false alarms', () => {
    const text = 'Více informací naleznete na oficiálním webu https://www.ceskaposta.cz/sluzby.';
    const result = analyzeUrls(text);
    expect(result.hasUrl).toBe(true);
    expect(result.evidences.some(e => e.category === 'IMPERSONATION')).toBe(false);
    expect(result.suspiciousScore).toBe(0);
  });
  it('parses userinfo and multi-level suffixes without trusting misleading labels', () => {
    expect(parseHostname('https://ceskaposta.cz@attacker.example')).toBe('attacker.example');
    expect(analyzeUrls('https://ceskaposta.cz@attacker.example').evidences.some(e => e.id === 'URL_USERINFO')).toBe(true);
    const ev = analyzeUrls('https://banka.example.co.uk').evidences.find(e => e.id === 'URL_MISLEADING_SUBDOMAIN');
    expect(ev?.description).toContain('example.co.uk');
    expect(analyzeUrls('https://ceskaposta.cz.attacker.example').evidences.some(e => e.id === 'IMPERSONATION_CESKAPOSTA')).toBe(true);
  });

  it('does not treat an unknown .xyz or internationalized name as proof of fraud', () => {
    expect(analyzeUrls('https://example.xyz/').evidences).toHaveLength(0);
    expect(analyzeUrls('https://háčky.cz/').evidences.some(e => e.severity === 'CRITICAL')).toBe(false);
    expect(parseHostname('http://[broken')).toBeNull();
  });

});
