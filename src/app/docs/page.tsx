import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { ArrowUpRight, BookOpen, Terminal } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const copy = {
  cs: {
    title: 'Dokumentace', lead: 'Od první analýzy k integraci API. Každý příklad odpovídá současné místní verzi.',
    start: 'Začít', request: 'První požadavek', key: 'Projektový klíč', result: 'Výsledek', limits: 'Omezení', more: 'Úplná specifikace API',
    startBody: 'Spusťte místní server na portu 3005. Veřejná zkušební cesta používá pravidla a nevyžaduje účet. Pro skutečné nasazení zatím chybí ochrana anonymního provozu.',
    requestBody: 'Pošlete smyšlený text. Server vrátí strukturované rozhodnutí, citované signály a další kroky. Zprávy neukládá do databáze.',
    keyBody: 'V místním účtu nejprve ověřte e-mail, vytvořte projekt a klíč. Plný klíč se zobrazí jednou. Požadavky s klíčem potřebují nové Idempotency-Key a spotřebují testovací kredit.',
    resultBody: 'Nejdříve zkontrolujte decision a engine.mode. Pole signals a evidence ukazují konkrétní úryvky; nejistotu a bezpečné další kroky najdete v uncertainty a recommendedActions.',
    limitsBody: 'Klíč má rozsah oprávnění, expiraci a denní kvótu. AI vyžaduje zvláštní souhlas; při výpadku může přijít pravidlový výsledek. Současný server není určen k veřejnému provozu SaaS.',
    openKeys: 'Správa klíčů', openPlayground: 'Vyzkoušet API',
  },
  en: {
    title: 'Documentation', lead: 'From a first analysis to an API integration. Every example reflects the current local build.',
    start: 'Get started', request: 'First request', key: 'Project key', result: 'Read the result', limits: 'Limits', more: 'Full API specification',
    startBody: 'Run the local server on port 3005. The public trial path uses rules and needs no account. Anonymous traffic protection is not ready for a public deployment.',
    requestBody: 'Send synthetic text. The server returns a structured decision, cited signals and next steps. It does not store messages in its database.',
    keyBody: 'In the local account, verify email, create a project and issue a key. The full secret is shown once. Keyed requests need a fresh Idempotency-Key and consume a test credit.',
    resultBody: 'Check decision and engine.mode first. signals and evidence point to specific excerpts; uncertainty and recommendedActions give the limits and safer next steps.',
    limitsBody: 'Keys have scopes, expiration and a daily quota. AI requires separate consent and may fall back to rules. This server is not ready for public SaaS traffic.',
    openKeys: 'Manage keys', openPlayground: 'Try the API',
  },
} as const;

const guestCurl = `curl http://127.0.0.1:3005/api/v1/analyses \\
  -H 'Content-Type: application/json' \\
  --data '{"text":"Podezřelá zpráva", "enableLlm":false}'`;
const keyedCurl = `curl http://127.0.0.1:3005/api/v1/analyses \\
  -H 'Content-Type: application/json' \\
  -H "Authorization: Bearer $OVERTO_TEST_KEY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  --data '{"text":"Podezřelá zpráva", "enableLlm":false}'`;

export default async function DocsPage() {
  const locale = await getLocale();
  const t = copy[locale === 'en' ? 'en' : 'cs'];
  const sections = [
    { id: 'start', label: t.start }, { id: 'request', label: t.request },
    { id: 'key', label: t.key }, { id: 'result', label: t.result }, { id: 'limits', label: t.limits },
  ];
  return <div className="flex min-h-screen flex-col"><Header/><main id="main" className="docs-layout shell flex-1">
    <aside className="docs-sidebar"><p className="docs-sidebar-title"><BookOpen size={17} aria-hidden="true"/> OvěřTo.AI</p><nav aria-label={t.title}>{sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}</nav><div className="docs-sidebar-footer"><Link href="/developers">{t.openPlayground}<ArrowUpRight size={15} aria-hidden="true"/></Link><a href="https://github.com/yuanweize/OverTo.AI/blob/main/docs/api/v1.md">{t.more}<ArrowUpRight size={15} aria-hidden="true"/></a></div></aside>
    <article className="docs-article"><header><p className="eyebrow"><Terminal size={17} aria-hidden="true"/> API v1 · Local build</p><h1>{t.title}</h1><p className="docs-lead">{t.lead}</p></header>
      <section id="start"><h2>{t.start}</h2><p>{t.startBody}</p></section>
      <section id="request"><h2>{t.request}</h2><p>{t.requestBody}</p><pre className="docs-code"><code>{guestCurl}</code></pre></section>
      <section id="key"><h2>{t.key}</h2><p>{t.keyBody}</p><pre className="docs-code"><code>{keyedCurl}</code></pre><Link className="docs-inline-link" href="/dashboard/api-keys">{t.openKeys}<ArrowUpRight size={16} aria-hidden="true"/></Link></section>
      <section id="result"><h2>{t.result}</h2><p>{t.resultBody}</p><div className="docs-fields"><code>decision</code><code>signals</code><code>evidence</code><code>uncertainty</code><code>recommendedActions</code><code>engine</code></div></section>
      <section id="limits"><h2>{t.limits}</h2><p>{t.limitsBody}</p><Link className="docs-inline-link" href="/security">{t.limits}<ArrowUpRight size={16} aria-hidden="true"/></Link></section>
    </article>
  </main><Footer/></div>;
}
