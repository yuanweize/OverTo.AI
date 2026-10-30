import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {pool} from '@/auth/server';
import {getPlatformAdmin} from '@/server/config/admin';
import {EvaluationControl} from '@/features/ai-studio/EvaluationControl';
export default async function EvaluationsPage(){
  if(!pool||!await getPlatformAdmin(await headers()))redirect('/login');
  const t=await getTranslations('Evaluations');
  const runs=await pool.query('SELECT id,mode,model,prompt_version,dataset_version,status,summary,rows,created_at FROM ai_evaluation_runs ORDER BY created_at DESC LIMIT 30');
  return <><p className="eyebrow">AI Studio</p><h1 className="mt-3 text-4xl font-bold">{t('title')}</h1><p className="muted mt-4 max-w-3xl leading-7">{t('intro')}</p><EvaluationControl/><section className="mt-8"><h2 className="text-xl font-semibold">{t('history')}</h2>{!runs.rowCount?<p className="muted mt-5">{t('empty')}</p>:<ol className="mt-5 divide-y divide-slate-200">{runs.rows.map(run=><li key={run.id} className="py-5"><details><summary className="min-h-11 cursor-pointer font-semibold">{run.mode} · {run.status} · {run.created_at.toISOString()}</summary><p className="muted mt-3 break-all text-xs">{run.id} · {run.model??'No model'} · {run.prompt_version} · {run.dataset_version}</p><pre className="developer-code mt-4 overflow-auto rounded-lg p-5 text-xs leading-6">{JSON.stringify({summary:run.summary,cases:run.rows},null,2)}</pre></details></li>)}</ol>}</section></>;
}
