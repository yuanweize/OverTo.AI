import { describe, expect, it } from 'vitest';
import { defaultSiteConfig, validateSiteConfig } from '@/server/config/site-schema';
import { resolveLocale } from '@/i18n/locale';

describe('public site configuration boundary', () => {
  it('returns only typed safe defaults', () => {
    expect(validateSiteConfig({})).toEqual(defaultSiteConfig);
  });
  it.each([
    { apiKey: 'secret' }, { siteName: '<script>' }, { logoPath: 'https://example.com/a.svg' },
    { logoPath: '/brand/../../private.svg' }, { brandColor: '#ffffff' },
    { brandColor: 'red' }, { supportUrl: 'javascript:alert(1)' },
    { supportUrl: 'https://user:password@example.com' }, { defaultLocale: 'de' },
    { defaultTheme: 'custom' }, { siteName: ' ' }, { announcementEn: 'a'.repeat(301) },
    JSON.parse('{"__proto__":{"polluted":true}}'), { siteName: 10 },
  ])('rejects unsafe or unrecognized configuration %j', input => {
    expect(() => validateSiteConfig(input)).toThrow();
  });
  it('accepts Czech branding and a contrasting custom accent', () => {
    expect(validateSiteConfig({ siteName: 'Ověření', brandColor: '#174263' })).toMatchObject({ siteName: 'Ověření', brandColor: '#174263' });
  });
});
describe('language negotiation', () => {
  it('honours explicit choice before browser preferences', () => expect(resolveLocale('cs', 'en-US')).toBe('cs'));
  it('chooses the highest quality supported browser language', () => expect(resolveLocale(undefined, 'de;q=1,en-US;q=0.9,cs;q=0.7')).toBe('en'));
  it('uses Czech for unsupported or invalid browser languages', () => {
    expect(resolveLocale(undefined, 'de,fr')).toBe('cs');
    expect(resolveLocale(undefined, 'en;q=0,cs;q=NaN')).toBe('cs');
  });
});
