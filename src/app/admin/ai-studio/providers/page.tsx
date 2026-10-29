import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import {getTranslations} from 'next-intl/server';
import {pool} from '@/auth/server';
import {getPlatformAdmin} from '@/server/config/admin';
import {ProviderRepository} from '@/ai/providers/repository';
import {ProviderForm} from '@/features/ai-studio/ProviderForm';
export default async function ProvidersPage(){
  if(!pool||!await getPlatformAdmin(await headers()))redirect('/login');
  const t=await getTranslations('Providers'),snapshot=await new ProviderRepository(pool).read();
  return <><p className="eyebrow">AI Studio / OpenAI-compatible</p><h1 className="mt-3 text-4xl font-bold">{t('title')}</h1><p className="muted mt-4 max-w-3xl leading-7">{t('intro')}</p><p className="mt-5 text-sm">{t('credential')}: {process.env.OPENAI_API_KEY?t('present'):t('missing')}</p><ProviderForm initial={snapshot}/><section className="mt-10 border-t border-slate-200 pt-6"><h2 className="text-xl font-semibold">{t('diagnostic')}</h2><p className="muted mt-3 max-w-2xl leading-7">{t('diagnosticNote')}</p><Link className="button button-secondary mt-5" href="/admin/ai-studio/prompts">Prompt Lab</Link></section></>;
}
