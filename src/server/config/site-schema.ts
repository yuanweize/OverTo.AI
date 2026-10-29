export interface SiteConfig {
  siteName: string;
  descriptionCs: string;
  descriptionEn: string;
  logoPath: string;
  brandColor: string;
  defaultLocale: 'cs' | 'en';
  defaultTheme: 'system' | 'light' | 'dark';
  supportUrl: string;
  contactEmail: string;
  announcementCs: string;
  announcementEn: string;
}
export const defaultSiteConfig: SiteConfig = {
  siteName: 'OvěřTo.AI',
  descriptionCs: 'Porozumějte podezřelé zprávě. Rozhodujte se s rozvahou.',
  descriptionEn: 'Understand a suspicious message. Make your next move with care.',
  logoPath: '/brand/mark.svg', brandColor: '#2454cf', defaultLocale: 'cs', defaultTheme: 'system',
  supportUrl: 'https://github.com/yuanweize/OverTo.AI/issues', contactEmail: '', announcementCs: '', announcementEn: '',
};
export function validateSiteConfig(input: unknown): SiteConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_CONFIG');
  const object = input as Record<string, unknown>;
  if (Object.keys(object).some(key => !Object.hasOwn(defaultSiteConfig, key))) throw new Error('UNKNOWN_SETTING');
  const value = { ...defaultSiteConfig, ...object } as SiteConfig;
  const limits: Record<string, number> = { siteName: 60, descriptionCs: 240, descriptionEn: 240, logoPath: 180, brandColor: 7, supportUrl: 500, contactEmail: 200, announcementCs: 300, announcementEn: 300 };
  for (const [key, max] of Object.entries(limits)) {
    if (typeof value[key as keyof SiteConfig] !== 'string' || (value[key as keyof SiteConfig] as string).length > max || /[\u0000-\u001f<>]/u.test(value[key as keyof SiteConfig])) throw new Error('INVALID_' + key);
  }
  if (!value.siteName.trim() || !['cs', 'en'].includes(value.defaultLocale) || !['light', 'dark', 'system'].includes(value.defaultTheme)) throw new Error('INVALID_CONFIG');
  if (!/^\/brand\/[a-zA-Z0-9_-]+\.(svg|png|webp)$/.test(value.logoPath)) throw new Error('INVALID_LOGO');
  if (!/^#[0-9a-f]{6}$/i.test(value.brandColor)) throw new Error('INVALID_COLOR');
  const rgb = value.brandColor.slice(1).match(/../g)!.map(hex => parseInt(hex, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  if (1.05 / (luminance + 0.05) < 4.5) throw new Error('COLOR_CONTRAST');
  if (value.supportUrl) {
    let url: URL; try { url = new URL(value.supportUrl); } catch { throw new Error('INVALID_SUPPORT_URL'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('INVALID_SUPPORT_URL');
  }
  if (value.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contactEmail)) throw new Error('INVALID_EMAIL');
  return value;
}
