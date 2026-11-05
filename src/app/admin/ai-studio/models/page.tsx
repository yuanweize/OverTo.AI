import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { pool } from '@/auth/server';
import { getPlatformAdmin } from '@/server/config/admin';
import { ProviderRepository } from '@/ai/providers/repository';
import { ModelRegistry } from '@/features/ai-studio/ModelRegistry';
import { ModelPricingForm } from '@/features/ai-studio/ModelPricingForm';

export default async function ModelsPage() {
  if (!pool || !await getPlatformAdmin(await headers())) redirect('/login');
  const [t, snapshot] = await Promise.all([getTranslations('Models'), new ProviderRepository(pool).read()]);
  const prices = await pool.query<{ model: string; input_per_million_usd: string; output_per_million_usd: string; max_request_cost_usd: string; verified_at: Date | null }>(
    'SELECT model,input_per_million_usd,output_per_million_usd,max_request_cost_usd,verified_at FROM ai_model_pricing WHERE model = ANY($1::text[])', [snapshot.config.allowedModels]);
  const pricing = prices.rows.map(row => ({ model: row.model, inputPerMillionUsd: Number(row.input_per_million_usd), outputPerMillionUsd: Number(row.output_per_million_usd), maxRequestCostUsd: Number(row.max_request_cost_usd), verified: !!row.verified_at }));
  return <><p className="eyebrow">AI Studio / Models</p><h1 className="mt-3 text-4xl font-bold">{t('title')}</h1><p className="muted mt-4 max-w-3xl leading-7">{t('intro')}</p><ModelRegistry initial={snapshot}/><ModelPricingForm models={snapshot.config.allowedModels} pricing={pricing}/></>;
}
