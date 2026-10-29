import Link from 'next/link';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getPlatformAdmin } from '@/server/config/admin';
import { pool } from '@/auth/server';
import { TraceRepository } from '@/ai/traces/repository';
export default async function AiStudioPage() {
  const t = await getTranslations('Studio');
  const user = await getPlatformAdmin(await headers());
  if (!user || !pool) return <><Header/><main id="main" className="shell py-16"><h1 className="text-3xl font-bold">AI Studio</h1><p className="mt-5">{t('denied')}</p><Link href="/login" className="button button-primary mt-5">{t('login')}</Link></main><Footer/></>;
  const repository = new TraceRepository(pool);
  const [summary, traces] = await Promise.all([repository.summary(), repository.recent()]);
  const metrics = [[t('requests'), summary.requests], [t('success'), summary.successes], [t('failed'), summary.failures], [t('blocked'), summary.unavailable], [t('latency'), summary.average_ms === null ? t('unknown') : `${summary.average_ms} ms`]];
  return <div><Link href="/admin" className="text-link">{t('settings')}</Link><h1 className="mt-5 text-4xl font-bold tracking-tight">AI Studio</h1><p className="muted mt-4 max-w-3xl leading-7">{t('intro')}</p><div className="studio-metrics mt-8">{metrics.map(([label,value])=><section key={label}><h2>{label}</h2><p>{value}</p></section>)}</div><p className="muted mt-4 text-sm">{t('tokenReports', { count: summary.token_reports })} · {t('costUnknown')}</p><section className="mt-10"><h2 className="text-2xl font-semibold">{t('traces')}</h2><p className="muted mt-2 text-sm">{t('privacy')}</p>{traces.length === 0 ? <p className="mt-5 border-y border-slate-200 bg-white p-6">{t('empty')}</p> : <ol className="mt-5 border-t border-slate-200">{traces.map(trace=><li key={trace.id}><details className="studio-trace"><summary><span className="font-semibold">{trace.status}</span><span className="muted break-all text-sm">{trace.model || t('unknown')} · {trace.duration_ms} ms · {new Date(trace.created_at).toISOString()}</span></summary><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">{[[t('traceId'),trace.id],[t('provider'),trace.provider],[t('prompt'),trace.prompt_version],[t('inputTokens'),trace.input_tokens ?? t('unknown')],[t('outputTokens'),trace.output_tokens ?? t('unknown')],[t('rejected'),trace.rejected_evidence ?? t('unknown')],[t('reason'),trace.failure_reason || '—'],[t('cost'),trace.estimated_cost_usd ?? t('unknown')]].map(([label,value])=><div key={String(label)}><dt className="muted">{label}</dt><dd className="mt-1 break-all font-medium">{value}</dd></div>)}</dl></details></li>)}</ol>}</section><p className="muted mt-8 max-w-3xl text-sm leading-7">{t('scope')}</p></div>;
}
