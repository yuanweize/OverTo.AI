import { TestComparison } from '@/features/ai-studio/TestComparison';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getPlatformAdmin } from '@/server/config/admin';
import { pool } from '@/auth/server';
import { PromptRepository } from '@/ai/prompts/repository';
import { defaultPrompt } from '@/ai/prompts/default';
import { PromptLab } from '@/features/ai-studio/PromptLab';
export default async function PromptsPage() {
  if (!await getPlatformAdmin(await headers()) || !pool) redirect('/login');
  const [t, locale]=await Promise.all([getTranslations('PromptLab'),getLocale()]);
  const data=await new PromptRepository(pool).list();
  const auditRow=(row:(typeof data.audit)[number],index:number)=><li key={`${row.created_at.toISOString()}-${index}`} className="audit-row"><span className="font-semibold">{row.action}</span><code title={row.target_id}>{row.target_id.slice(0,12)}</code><time dateTime={row.created_at.toISOString()}>{row.created_at.toLocaleString(locale==='cs'?'cs-CZ':'en-GB')}</time></li>;
  return <><p className="eyebrow">AI Studio / Prompt Lab</p><h1 className="mt-3 text-4xl font-bold tracking-tight">{t('title')}</h1><p className="muted mt-4 max-w-3xl leading-7">{t('intro')}</p><PromptLab versions={data.versions} activeId={data.activation.prompt_id} activationVersion={data.activation.version} defaultInstructions={defaultPrompt.instructions}/><TestComparison tests={data.tests.map(row=>({...row,created_at:row.created_at.toISOString()}))}/><section className="mt-10"><h2 className="text-xl font-semibold">{t('history')}</h2><p className="muted mt-2 text-sm">{t('historyNote')}</p><div className="mt-4 overflow-auto"><table className="studio-table"><thead><tr><th>{t('version')}</th><th>Model</th><th>{t('status')}</th><th>{t('duration')}</th><th>Tokens (in / out)</th></tr></thead><tbody>{data.tests.map(row=><tr key={row.id}><td><code>{row.prompt_id.slice(0,8)}</code></td><td>{row.model}</td><td>{row.status}</td><td>{row.duration_ms} ms</td><td>{row.input_tokens??'—'} / {row.output_tokens??'—'}</td></tr>)}</tbody></table></div></section><section className="mt-10"><h2 className="text-xl font-semibold">{t('audit')}</h2><ol className="audit-list mt-4">{data.audit.slice(0,5).map(auditRow)}</ol>{data.audit.length>5&&<details className="audit-more"><summary>{t('olderAudit',{count:data.audit.length-5})}</summary><ol className="audit-list">{data.audit.slice(5).map((row,index)=>auditRow(row,index+5))}</ol></details>}</section></>;
}
