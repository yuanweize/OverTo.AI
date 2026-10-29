import cs from './messages/cs.json';
import en from './messages/en.json';
import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { resolveLocale } from './locale';
import { getSiteSnapshot } from '@/server/config/site';
export default getRequestConfig(async () => {
  const [cookieStore, requestHeaders, site] = await Promise.all([cookies(), headers(), getSiteSnapshot()]);
  const locale = resolveLocale(cookieStore.get('overto-locale')?.value, requestHeaders.get('accept-language'), site.config.defaultLocale);
  return { locale, messages: locale === 'en' ? en : cs, timeZone: 'Europe/Prague' };
});
