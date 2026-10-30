import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {getPlatformAdmin} from '@/server/config/admin';
import {CHALLENGE_SET} from '@/evaluation/challenge-dataset';
export default async function DatasetsPage(){
  if(!await getPlatformAdmin(await headers()))redirect('/login');const t=await getTranslations('Evaluations');
  return <><p className="eyebrow">AI Studio / challenge-v1</p><h1 className="mt-3 text-4xl font-bold">{t('dataset')}</h1><p className="muted mt-4 max-w-3xl leading-7">{t('datasetNote',{count:CHALLENGE_SET.length})}</p><ol className="mt-8 divide-y divide-slate-200">{CHALLENGE_SET.map(item=><li className="py-5" key={item.id}><details><summary className="min-h-11 cursor-pointer font-semibold">{item.id} · {item.truth} · {item.category}</summary><blockquote className="mt-3 border-l-2 border-slate-300 pl-4 leading-7">{item.text}</blockquote><p className="muted mt-3 text-sm leading-6">{item.rationale}</p></details></li>)}</ol></>;
}
