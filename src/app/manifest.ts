import type { MetadataRoute } from 'next';
import { getSiteSnapshot } from '@/server/config/site';
export const dynamic = 'force-dynamic';
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { config } = await getSiteSnapshot();
  return {
    name: config.siteName, short_name: config.siteName,
    description: config.defaultLocale === 'en' ? config.descriptionEn : config.descriptionCs,
    start_url: '/', display: 'standalone', background_color: '#f5f7fb', theme_color: config.brandColor,
    icons: config.logoPath === '/brand/mark.svg' ? [
      { src:'/brand/icon-192.png',sizes:'192x192',type:'image/png' },
      { src:'/brand/icon-512.png',sizes:'512x512',type:'image/png' },
      { src:'/brand/icon-maskable.png',sizes:'512x512',type:'image/png',purpose:'maskable' },
    ] : [{ src:config.logoPath,sizes:'any',type:config.logoPath.endsWith('.svg')?'image/svg+xml':config.logoPath.endsWith('.webp')?'image/webp':'image/png' }],
  };
}
