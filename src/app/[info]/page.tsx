import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { ArrowRight, BookOpen, ExternalLink } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

type Content = { title: string; lead: string; sections: { title: string; body: string }[]; action: string; href: string };
const pages = {
  docs: {
    cs: { title: 'Dokumentace', lead: 'Začněte analýzou zprávy, vyzkoušejte API a ověřte si hranice současné lokální verze.', sections: [
      { title: 'Veřejná analýza', body: 'Vložte podezřelou zprávu, před odesláním zkontrolujte maskovaný text a vyberte pravidla nebo AI se souhlasem. Výsledek obsahuje citace, nejistotu a bezpečný další krok.' },
      { title: 'API a klíče', body: 'Veřejný endpoint podporuje analýzu pravidly. V místním přihlášeném prostředí lze vytvořit projektový klíč s rozsahem oprávnění, omezením počtu požadavků a expirací. Klíč je zobrazen pouze jednou.' },
      { title: 'Vlastní provoz', body: 'Zdrojový kód, technická dokumentace a stav jednotlivých funkcí jsou v repozitáři. Produkční autentizace a placené AI požadavky jsou zatím záměrně vypnuté.' },
    ], action: 'Prozkoumat API', href: '/developers' },
    en: { title: 'Documentation', lead: 'Start with a message analysis, try the API, and understand the limits of this local development build.', sections: [
      { title: 'Public analysis', body: 'Paste a suspicious message, review redacted text before sending, and choose rules or consent based AI. Results include quoted evidence, uncertainty and a safer next step.' },
      { title: 'API and keys', body: 'The public endpoint supports rules analysis. In the local signed in workspace, project keys have scopes, request limits and expiration. Each secret is shown once.' },
      { title: 'Self hosting', body: 'Source code, technical documentation and feature status live in the repository. Production authentication and paid AI requests remain deliberately disabled.' },
    ], action: 'Explore the API', href: '/developers' },
  },
  features: {
    cs: { title: 'Od zprávy k ověřitelnému rozhodnutí', lead: 'OvěřTo.AI propojuje signály v textu s konkrétním postupem, který můžete provést sami.', sections: [
      { title: 'Důkazy v původním textu', body: 'Varovné signály odkazují na přesné úryvky. Opakované a nejednoznačné výskyty jsou označené; nepodložené citace modelu se odmítají.' },
      { title: 'Pravidla a volitelná AI', body: 'Pravidla fungují bez účtu a bez modelu. AI může po výslovném souhlasu doplnit kontext; její výpadek vrací pravidlový výsledek a bezpečnostní úsudek zůstává omezený.' },
      { title: 'Nástroje pro vývojáře', body: 'Verzované JSON API, lokální projekty, testovací kredity, projektové klíče a metadatové záznamy využití umožňují ověřit integrační postup.' },
    ], action: 'Ověřit zprávu', href: '/analyze' },
    en: { title: 'From a message to a verifiable decision', lead: 'OvěřTo.AI connects signals in a message with a concrete step you can take yourself.', sections: [
      { title: 'Evidence in the original text', body: 'Risk signals point to exact excerpts. Repeated and ambiguous locations are marked; model quotations without source support are rejected.' },
      { title: 'Rules and optional AI', body: 'Rules work without an account or model. With explicit consent, AI can add context; a provider failure returns the rules result and all conclusions remain limited.' },
      { title: 'Developer tools', body: 'A versioned JSON API, local projects, test credits, scoped project keys and metadata only usage records support integration testing.' },
    ], action: 'Analyze a message', href: '/analyze' },
  },
  'how-it-works': {
    cs: { title: 'Jak ověření funguje', lead: 'Zprávu nejprve připravíte, potom uvidíte důvody výsledku a nakonec ověříte žádost jinou cestou.', sections: [
      { title: '1. Zkontrolujte text', body: 'Aplikace se pokouší maskovat rozpoznané osobní údaje. Před odesláním text sami prohlédněte a odstraňte vše, co nechcete sdílet.' },
      { title: '2. Projděte signály', body: 'Pravidla vyhledají rizikové vzorce. Volitelný model smí navrhnout pouze strukturované signály opřené o citace z textu.' },
      { title: '3. Ověřte nezávisle', body: 'Neplaťte ani nesdělujte přístupové údaje podle samotné zprávy. Obraťte se na známé číslo, oficiální aplikaci nebo vlastní kontakt.' },
    ], action: 'Začít analýzu', href: '/analyze' },
    en: { title: 'How verification works', lead: 'Review the message first, inspect the reasons in the result, then verify the request through a separate channel.', sections: [
      { title: '1. Review the text', body: 'The app attempts to mask recognized personal data. Inspect it yourself before sending and remove anything you do not want to share.' },
      { title: '2. Inspect signals', body: 'Rules find risk patterns. An optional model may suggest structured signals only when they are grounded in excerpts from the text.' },
      { title: '3. Verify independently', body: 'Do not pay or share credentials based on the message alone. Use a known phone number, an official app or a contact you found yourself.' },
    ], action: 'Start an analysis', href: '/analyze' },
  },
  security: {
    cs: { title: 'Bezpečnost a její hranice', lead: 'Bezpečnostní opatření popisujeme podle toho, co nyní skutečně funguje.', sections: [
      { title: 'Omezení vstupů a volání', body: 'API omezuje velikost požadavků. Místní projektové klíče jsou ukládané jako hash, mají expiraci, rozsahy oprávnění a sdílené limity pro klíč, projekt a pracovní prostor.' },
      { title: 'Správa a platby', body: 'Administrátorské změny vyžadují ověřený účet s rolí ROOT a ukládají auditní události. Experimentální Stripe webhook ověřuje podpis a opakované události nesmějí vydat kredit dvakrát.' },
      { title: 'Stav nasazení', body: 'Produkční autentizace a placené AI požadavky jsou vypnuté. Anonymní veřejný provoz a víceinstanční rozpočty poskytovatelů ještě nejsou připravené; místní server nevystavujte na internet.' },
    ], action: 'Bezpečnostní zásady v repozitáři', href: 'https://github.com/yuanweize/OverTo.AI/blob/main/SECURITY.md' },
    en: { title: 'Security and its limits', lead: 'We describe safeguards according to what is currently implemented.', sections: [
      { title: 'Request and call limits', body: 'The API bounds request size. Local project keys are stored as hashes and have expiration, scopes and shared limits across the key, project and workspace.' },
      { title: 'Administration and billing', body: 'Admin changes require a verified ROOT account and create audit events. The experimental Stripe webhook verifies signatures and replayed events must not grant credits twice.' },
      { title: 'Deployment status', body: 'Production authentication and paid AI requests are disabled. Anonymous public admission and distributed provider budgets are unfinished; do not expose the local server to the internet.' },
    ], action: 'Repository security policy', href: 'https://github.com/yuanweize/OverTo.AI/blob/main/SECURITY.md' },
  },
  privacy: {
    cs: { title: 'Soukromí při analýze', lead: 'Před použitím AI rozhodujete, jaký text odešlete modelové službě.', sections: [
      { title: 'Zprávy a analýzy', body: 'Text zprávy aplikace neukládá do databáze. Při analýze AI se po vašem souhlasu odešle zkontrolovaný text nakonfigurovanému poskytovateli; automatické maskování nemusí odstranit všechny citlivé údaje.' },
      { title: 'Provozní data', body: 'V místním účtu se ukládají přihlašovací a projektová data, kreditní účet a metadata o využití. AI trace ukládá stav, model, dobu a hlášené tokeny bez zprávy nebo přístupového klíče.' },
      { title: 'Další poskytovatelé', body: 'Modelový poskytovatel, hosting a případně Stripe v testovacím režimu zpracovávají data podle svých podmínek. Jejich uchování řídí provozovatel konkrétního nasazení.' },
    ], action: 'Zkontrolovat text před analýzou', href: '/analyze' },
    en: { title: 'Privacy during analysis', lead: 'You decide what text is sent to a model service before enabling AI.', sections: [
      { title: 'Messages and analyses', body: 'The app does not store message text in its database. With your consent, the reviewed text goes to the configured model provider; automatic redaction may miss sensitive details.' },
      { title: 'Operational data', body: 'Local accounts store authentication and project data, a credit account and usage metadata. AI traces store status, model, duration and reported tokens without the message or access key.' },
      { title: 'Other providers', body: 'The model provider, hosting operator and optional Stripe test integration process data under their own terms. Retention depends on the specific deployment.' },
    ], action: 'Review text before analysis', href: '/analyze' },
  },
  terms: {
    cs: { title: 'Podmínky místní vývojové verze', lead: 'Tato stránka popisuje současný projekt. Není to hotová smlouva pro veřejnou placenou službu.', sections: [
      { title: 'Účel', body: 'OvěřTo.AI pomáhá vyhodnotit možné varovné signály. Výsledek nemůže potvrdit totožnost odesílatele, pravost odkazu ani bezpečnost platby.' },
      { title: 'Testovací účty a kredity', body: 'Místní účty, kredity a Stripe testovací režim slouží k vývoji. Nejde o veřejnou placenou službu ani o reálné finanční prostředky.' },
      { title: 'Vlastní nasazení', body: 'Provozovatel vlastní instance musí stanovit vlastní podmínky, zásady soukromí a provozní zabezpečení podle svého nasazení. Zdrojový kód podléhá licenci uvedené v repozitáři.' },
    ], action: 'Zobrazit zdrojový kód', href: 'https://github.com/yuanweize/OverTo.AI' },
    en: { title: 'Local development terms', lead: 'This page describes the current project. It is not a finished contract for a public paid service.', sections: [
      { title: 'Purpose', body: 'OvěřTo.AI helps assess possible warning signs. A result cannot prove sender identity, link authenticity or payment safety.' },
      { title: 'Test accounts and credits', body: 'Local accounts, credits and Stripe test mode support development. They are not a public paid service or real money.' },
      { title: 'Your deployment', body: 'Operators of their own instance must set terms, privacy policies and operational safeguards for that deployment. Source code follows the license in the repository.' },
    ], action: 'View source code', href: 'https://github.com/yuanweize/OverTo.AI' },
  },
} satisfies Record<string, Record<'cs' | 'en', Content>>;

type Slug = keyof typeof pages;
function contentFor(slug: string, locale: string): Content | null {
  return slug in pages ? pages[slug as Slug][locale === 'en' ? 'en' : 'cs'] : null;
}
export function generateStaticParams() { return Object.keys(pages).map(info => ({ info })); }
export async function generateMetadata({ params }: { params: Promise<{ info: string }> }): Promise<Metadata> {
  const data = contentFor((await params).info, await getLocale());
  return data ? { title: `${data.title} · OvěřTo.AI`, description: data.lead } : {};
}
export default async function InformationPage({ params }: { params: Promise<{ info: string }> }) {
  const data = contentFor((await params).info, await getLocale());
  if (!data) notFound();
  const external = data.href.startsWith('https://');
  return <div className="flex min-h-screen flex-col"><Header/><main id="main" className="info-page shell flex-1"><div className="info-hero"><div><p className="eyebrow"><BookOpen size={17} aria-hidden="true"/>OvěřTo.AI</p><h1>{data.title}</h1><p className="info-lead">{data.lead}</p></div><div className="info-index" aria-hidden="true"><span>01 / 03</span><div className="info-index-line"/><span>Signal → Evidence → Action</span></div></div><div className="info-sections">{data.sections.map((section, index) => <section className="info-block" key={section.title}><span className="info-number">0{index + 1}</span><div><h2>{section.title}</h2><p>{section.body}</p></div></section>)}</div><div className="info-action">{external ? <a href={data.href} target="_blank" rel="noopener noreferrer">{data.action}<ExternalLink size={18} aria-hidden="true"/></a> : <Link href={data.href}>{data.action}<ArrowRight size={18} aria-hidden="true"/></Link>}</div></main><Footer/></div>;
}
