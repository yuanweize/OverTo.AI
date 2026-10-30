import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ArrowRight, BookOpen, KeyRound, ShieldAlert, Terminal } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ApiPlayground } from '@/components/ApiPlayground';

const guestExample = `curl http://127.0.0.1:3005/api/v1/analyses \\
  -H 'Content-Type: application/json' \\
  --data '{"text":"Podezřelá zpráva", "enableLlm":false}'`;
const keyExample = `curl http://127.0.0.1:3005/api/v1/analyses \\
  -H 'Content-Type: application/json' \\
  -H "Authorization: Bearer $OVERTO_TEST_KEY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  --data '{"text":"Podezřelá zpráva", "enableLlm":false}'`;

export default async function DevelopersPage() {
  const t = await getTranslations('Public');
  return <div className="developer-page flex min-h-screen flex-col"><Header/><main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20 pt-14 sm:pt-20">
    <div className="grid gap-10 lg:grid-cols-[1fr_19rem] lg:items-end"><div><p className="developer-kicker flex items-center gap-2 text-sm font-semibold"><Terminal size={17} aria-hidden="true"/> {t('devLabel')}</p><h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{t('devTitle')}</h1><p className="developer-muted mt-5 max-w-2xl text-lg leading-8">{t('devIntro')}</p><div className="mt-7 flex flex-wrap gap-3"><a href="#playground" className="developer-primary inline-flex min-h-12 items-center gap-2 rounded-lg px-5 font-semibold">{t('tryApi')} <ArrowRight size={18}/></a><Link href="/docs" className="developer-secondary inline-flex min-h-12 items-center gap-2 rounded-lg px-5 font-semibold"><BookOpen size={18}/> {t('docs')}</Link></div></div><div className="developer-panel rounded-xl p-5 text-sm leading-6"><p className="font-semibold">{t('status')}</p><p className="developer-muted mt-2">{t('version')}</p><p className="developer-muted mt-3">{t('availability')}</p></div></div>
    <section className="developer-rule mt-14 border-t pt-10"><h2 className="text-2xl font-bold">{t('modes')}</h2><p className="developer-muted mt-3 max-w-3xl leading-7">{t('modesText')}</p><div className="mt-7 grid gap-6 lg:grid-cols-2"><div className="min-w-0"><h3 id="guest-api-example" className="font-semibold">{t('guest')}</h3><p className="developer-muted mt-2 text-sm leading-6">{t('guestText')}</p><pre className="developer-code mt-4 overflow-x-auto rounded-xl p-5 text-sm leading-6" role="region" aria-labelledby="guest-api-example" tabIndex={0}><code>{guestExample}</code></pre></div><div className="min-w-0"><h3 id="key-api-example" className="flex items-center gap-2 font-semibold"><KeyRound size={17}/> {t('key')}</h3><p className="developer-muted mt-2 text-sm leading-6">{t('keyText')}</p><pre className="developer-code mt-4 overflow-x-auto rounded-xl p-5 text-sm leading-6" role="region" aria-labelledby="key-api-example" tabIndex={0}><code>{keyExample}</code></pre><Link href="/dashboard/api-keys" className="developer-link mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">{t('manage')}</Link></div></div></section>
    <section className="developer-notice mt-10 flex gap-3 rounded-xl p-5"><ShieldAlert className="mt-0.5 shrink-0" size={20} aria-hidden="true"/><div><h2 className="font-semibold">{t('limits')}</h2><p className="mt-2 text-sm leading-6">{t('limitsText')}</p></div></section>
    <section id="playground" className="developer-panel mt-12 rounded-xl p-5 sm:p-8"><h2 className="text-2xl font-bold">{t('realRequest')}</h2><p className="developer-muted mt-2 mb-6 leading-7">{t('realText')}</p><ApiPlayground/></section>
    <section className="developer-rule mt-12 border-t pt-8"><h2 className="text-xl font-bold">{t('responseTitle')}</h2><p className="developer-muted mt-3 max-w-3xl leading-7">{t('responseText')}</p></section>
  </main><Footer/></div>;
}
