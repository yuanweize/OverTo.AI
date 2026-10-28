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

export default function DevelopersPage() {
  return <div className="developer-page flex min-h-screen flex-col"><Header/><main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20 pt-14 sm:pt-20">
    <div className="grid gap-10 lg:grid-cols-[1fr_19rem] lg:items-end"><div><p className="developer-kicker flex items-center gap-2 text-sm font-semibold"><Terminal size={17} aria-hidden="true"/> Vývojářské rozhraní</p><h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Analýza zpráv, kterou můžete integrovat.</h1><p className="developer-muted mt-5 max-w-2xl text-lg leading-8">Experimentální API vrací signály, úryvky a doporučené kroky. Výsledek pomáhá s ověřením; nepotvrzuje pravost zprávy.</p><div className="mt-7 flex flex-wrap gap-3"><a href="#playground" className="developer-primary inline-flex min-h-12 items-center gap-2 rounded-lg px-5 font-semibold">Vyzkoušet API <ArrowRight size={18}/></a><a href="https://github.com/yuanweize/ai-vyzva-cesko-2026/blob/main/docs/api/v1.md" className="developer-secondary inline-flex min-h-12 items-center gap-2 rounded-lg px-5 font-semibold"><BookOpen size={18}/> Úplná dokumentace</a></div></div><div className="developer-panel rounded-xl p-5 text-sm leading-6"><p className="font-semibold">Stav rozhraní</p><p className="developer-muted mt-2">Lokální experiment · verze 1.0</p><p className="developer-muted mt-3">Komerční API, produkční klíče a veřejné nasazení zatím nejsou dostupné.</p></div></div>
    <section className="developer-rule mt-14 border-t pt-10"><h2 className="text-2xl font-bold">Dva způsoby použití</h2><p className="developer-muted mt-3 max-w-3xl leading-7">Na místním serveru lze vyzkoušet pravidla bez klíče. Testovací klíč je určen pro přihlášený lokální účet a měření testovacích kreditů.</p><div className="mt-7 grid gap-6 lg:grid-cols-2"><div className="min-w-0"><h3 className="font-semibold">1. Anonymní místní test</h3><p className="developer-muted mt-2 text-sm leading-6">Bez registrace a bez měření kreditů. Nepoužívejte jako veřejné produkční API.</p><pre className="developer-code mt-4 overflow-x-auto rounded-xl p-5 text-sm leading-6"><code>{guestExample}</code></pre></div><div className="min-w-0"><h3 className="flex items-center gap-2 font-semibold"><KeyRound size={17}/> 2. Lokální testovací klíč</h3><p className="developer-muted mt-2 text-sm leading-6">Vytvořte klíč v účtu, uložte jej bezpečně a pro každý požadavek použijte nové UUID.</p><pre className="developer-code mt-4 overflow-x-auto rounded-xl p-5 text-sm leading-6"><code>{keyExample}</code></pre><Link href="/dashboard/api-keys" className="developer-link mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Správa testovacích klíčů</Link></div></div></section>
    <section className="developer-notice mt-10 flex gap-3 rounded-xl p-5"><ShieldAlert className="mt-0.5 shrink-0" size={20} aria-hidden="true"/><div><h2 className="font-semibold">Ochrana a provozní hranice</h2><p className="mt-2 text-sm leading-6">Lokální proces omezuje velikost vstupu, počet souběžných požadavků a frekvenci volání modelu. Limity nejsou sdílené mezi instancemi ani přiřazené klientům a nenahrazují distribuované limity, kvóty a rozpočty poskytovatele. API proto nevystavujte veřejně.</p></div></section>
    <section id="playground" className="developer-panel mt-12 rounded-xl p-5 sm:p-8"><h2 className="text-2xl font-bold">Vyzkoušejte skutečný požadavek</h2><p className="developer-muted mt-2 mb-6 leading-7">Tento anonymní test odešle smyšlený text serveru a použije pouze pravidla.</p><ApiPlayground/></section>
    <section className="developer-rule mt-12 border-t pt-8"><h2 className="text-xl font-bold">Co odpověď obsahuje</h2><p className="developer-muted mt-3 max-w-3xl leading-7">Verzi schématu, rozhodnutí, signály, graf důkazů, doporučení a použitý režim analýzy. Výsledky se neukládají pro pozdější načtení. AI vyžaduje výslovný souhlas a může vrátit výsledek pravidel, pokud model není dostupný.</p></section>
  </main><Footer/></div>;
}
