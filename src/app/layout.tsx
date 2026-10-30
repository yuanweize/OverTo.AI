import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { getSiteSnapshot } from '@/server/config/site';
import { SiteProvider } from '@/components/branding/SiteProvider';
import './globals.css';
const inter = Inter({ subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--font-inter' });
export async function generateMetadata(): Promise<Metadata> {
  const [{ config }, locale] = await Promise.all([getSiteSnapshot(), getLocale()]);
  const description = locale === 'en' ? config.descriptionEn : config.descriptionCs;
  const base = process.env.OVERTO_PUBLIC_URL || process.env.BETTER_AUTH_URL || 'http://127.0.0.1:3005';
  return { metadataBase: new URL(base), title: config.siteName, description, twitter: { card: 'summary_large_image', title: config.siteName, description, images: ['/brand/social.png'] }, openGraph: { title: config.siteName, description, locale: locale === 'en' ? 'en_US' : 'cs_CZ', type: 'website', images: [{ url: '/brand/social.png', width: 1200, height: 630, alt: config.siteName }] } };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages, { config }, cookieStore] = await Promise.all([getLocale(), getMessages(), getSiteSnapshot(), cookies()]);
  const preference = cookieStore.get('overto-theme')?.value;
  const theme = preference && ['light', 'dark', 'system'].includes(preference) ? preference : config.defaultTheme;
  return <html lang={locale} data-theme={theme} data-scroll-behavior="smooth" className={`${inter.variable} h-full`} style={{ '--brand-action': config.brandColor } as React.CSSProperties}>
    <body className="min-h-full antialiased font-sans"><NextIntlClientProvider locale={locale} messages={messages}><SiteProvider config={config} theme={theme}>{children}</SiteProvider></NextIntlClientProvider></body>
  </html>;
}
