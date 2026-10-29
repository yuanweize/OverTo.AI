import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { pool } from '@/auth/server';
import { getPlatformAdmin } from '@/server/config/admin';
import { ProviderRepository } from '@/ai/providers/repository';
import { ModelRegistry } from '@/features/ai-studio/ModelRegistry';

export default async function ModelsPage() {
  if (!pool || !await getPlatformAdmin(await headers())) redirect('/login');
  const [t, snapshot] = await Promise.all([getTranslations('Models'), new ProviderRepository(pool).read()]);
  return <><p className="eyebrow">AI Studio / Models</p><h1 className="mt-3 text-4xl font-bold">{t('title')}</h1><p className="muted mt-4 max-w-3xl leading-7">{t('intro')}</p><ModelRegistry initial={snapshot}/></>;
}
