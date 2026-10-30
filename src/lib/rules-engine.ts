/**
 * OvěřTo.AI - Deterministic Scam Pattern & Rules Engine
 * Provádí hloubkovou analýzu textu na vzorce sociálního inženýrství
 * a generuje exaktní důkazy a akční verifikační kroky.
 */

import { VerificationAction, ScamCategory, Severity } from '@/types/analyzer';

export interface RuleMatch {
  ruleId: string;
  category: ScamCategory;
  severity: Severity;
  title: string;
  description: string;
  snippet?: string;
  weight: number;
}

export function stripDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function evaluateDeterministicRules(text: string): { matches: RuleMatch[]; actions: VerificationAction[] } {
  const stripped = stripDiacritics(text);
  const matches: RuleMatch[] = [];
  const actions: VerificationAction[] = [];

  // Pomocná funkce pro vyhledání a extrakci úryvku
  const findSnippet = (pattern: RegExp): string | undefined => {
    const match = text.match(pattern);
    if (match) {
      const index = match.index || 0;
      const start = Math.max(0, index - 20);
      const end = Math.min(text.length, index + match[0].length + 20);
      return text.substring(start, end).trim();
    }
    return undefined;
  };

  // 1. Vzdálený přístup (AnyDesk, TeamViewer...) - KRITICKÉ
  const remotePatterns = /\b(anydesk|teamviewer|supremo|rustdesk|quicksupport|vzdalenou spravu|vzdalenou pomoc|vzdaleny pristup|nainstalujte (si )?(aplikaci|program))\b/i;
  if (remotePatterns.test(stripped)) {
    matches.push({
      ruleId: 'REMOTE_ACCESS_DEMAND',
      category: 'REMOTE_ACCESS',
      severity: 'CRITICAL',
      title: 'Požadavek na instalaci vzdáleného přístupu',
      description: 'Text zmiňuje vzdálený přístup nebo instalaci programu. Kontext může být různý; nepovolujte přístup na základě nevyžádané žádosti a ověřte ji nezávisle.',
      snippet: findSnippet(remotePatterns),
      weight: 60,
    });
    actions.push({
      id: 'REMOTE_ACCESS_DEMAND_1',
      step: actions.length + 1,
      action: 'Okamžitě přerušte komunikaci a nic neinstalujte',
      rationale: 'Povolením vzdáleného přístupu můžete jiné osobě umožnit ovládat zařízení a získat citlivé údaje.',
      isWarning: true,
    });
  }

  // 2. Falešný bankéř / Převod na bezpečný účet - KRITICKÉ
  const safeAccountPatterns = /\b(bezpecny ucet|zachranny ucet|rezervni ucet|prevedte penize|prevest prostredky|bitcoinmat\w*|napaden|ucet byl zablokovan|ucet v ohrozeni)\b/i;
  if (safeAccountPatterns.test(stripped)) {
    matches.push({
      ruleId: 'SAFE_ACCOUNT_FRAUD',
      category: 'PAYMENT_DEMAND',
      severity: 'CRITICAL',
      title: 'Taktika „záchranného účtu“ / napadení banky',
      description: 'Zpráva tvrdí, že váš bankovní účet je ohrožen a je nutné převést peníze na jiný „bezpečný“ účet. Jde o typický znak reverzního bankovního podvodu.',
      snippet: findSnippet(safeAccountPatterns),
      weight: 55,
    });
    actions.push({
      id: 'SAFE_ACCOUNT_FRAUD_1',
      step: actions.length + 1,
      action: 'Vezměte svou platební kartu a zavolejte na oficiální telefonní číslo na její zadní straně',
      rationale: 'Požádejte banku o prověření tvrzení. Nepoužívejte číslo uvedené v podezřelé zprávě.',
      isWarning: false,
    });
  }

  // 3. WhatsApp rodinná nouze („Ahoj mami / tati...“) - KRITICKÉ
  const familyPatterns = /\b(ahoj mami|ahoj tati|nove cislo|stary telefon (mi )?(spadl|rozbil)|ztratil jsem telefon|potrebuji (nutne )?zaplatit|posli mi penize|nemohu se dostat k bankovnictvi)\b/i;
  // Require both a family/contact context and an actual money request. A
  // mention of broken banking or a family greeting alone is insufficient.
  const familyContext = /\b(mami|tati|babi|dedo|nove cislo|nov[eay] (docasne )?cislo|stary telefon|ztratil jsem telefon)\b/i.test(stripped);
  const changedContact = /\b(nov[eay] (docasne )?cislo|stary telefon|ztratil jsem telefon|rozbil\w* (se )?(mi )?telefon)\b/i.test(stripped);
  const monetaryContext = /\b(penize|ucet|kc|korun\w*|najem|platb\w*|zaplatit|prevest|prevod)\b/i.test(stripped);
  // Inspect each sentence so unrelated negation (e.g. "cannot access banking")
  // does not suppress a separate request. This is a heuristic, not an NLP parser.
  const clauses = stripped.split(/[.!?\n]+/);
  const familyDemand = clauses.some(clause => {
    if (/\b(nikdy|neposilej\w*|neposilat|neposlat|neplatte|neprevadej\w*|neprevest|nemusis|nemusite)\b/i.test(clause)) return false;
    return /\b(potrebuji (nutne )?zaplatit|posli\w* (mi )?(penize|\d)|posli\w* mi ihned|preved\w* (mi )?(penize|\d))\b/i.test(clause)
      || (monetaryContext && /\b(muzes|muzete|prosim)\b[^.!?\n]{0,80}\b(poslat|prevest|zaplatit)\b/i.test(clause));
  });
  if (familyContext && familyDemand) {
    matches.push({
      ruleId: 'FAMILY_EMERGENCY_SCAM',
      category: 'FAMILY_EMERGENCY',
      severity: changedContact ? 'CRITICAL' : 'MEDIUM',
      title: 'Možná žádost o platbu v rodinné komunikaci',
      description: 'Zpráva spojuje rodinný nebo změněný kontakt s žádostí o platbu. Může jít o skutečného příbuzného i o podvod; před platbou ověřte situaci nezávisle.',
      snippet: findSnippet(familyPatterns),
      weight: 50,
    });
    actions.push({
      id: 'FAMILY_EMERGENCY_SCAM_1',
      step: actions.length + 1,
      action: 'Zavolejte svému potomkovi / příbuznému na jeho PŮVODNÍ běžné telefonní číslo',
      rationale: 'Podvodníci se spoléhají na to, že budete jednat v emocích a neověříte si situaci u skutečné osoby.',
      isWarning: false,
    });
    actions.push({
      id: 'FAMILY_EMERGENCY_SCAM_2',
      step: actions.length + 1,
      action: 'Položte kontrolní otázku, jejíž odpověď znáte pouze vy a váš příbuzný',
      rationale: 'Odpověď sama o sobě není důkaz totožnosti; použijte také dříve známý kontakt.',
      isWarning: false,
    });
  }

  // 4. Požadavek na autorizační kódy (OTP / PIN / Heslo) - VYSOKÉ
  const otpPatterns = /\b(autorizacni kod|sms kod|potvrzovaci kod|zadejte (sve )?(heslo|pin)|prihlasovaci udaje|george klic|smart klic|preposlete.*kod|predejte kod|sdelte kod)\b/i;
  const otpDemand = /\b(zadejte|poslete|preposlete|sdelte|predejte|napiste|posli|poslete mi)\b/i.test(stripped);
  const otpNegation = /\b(nikdy|nesdelujte|neposilejte|nepreposilejte|nesdelovat|neposilat|nebude chtit)\b/i.test(stripped);
  if (otpPatterns.test(stripped) && otpDemand && !otpNegation) {
    matches.push({
      ruleId: 'OTP_CREDENTIAL_HARVEST',
      category: 'OTP_THEFT',
      severity: 'CRITICAL',
      title: 'Pokus o vylákání autorizačního kódu / hesla',
      description: 'Zpráva žádá o zadání nebo přeposlání autorizačního kódu, hesla či PINu. Jejich sdílení může umožnit přístup k účtu nebo potvrzení transakce.',
      snippet: findSnippet(otpPatterns),
      weight: 45,
    });
    actions.push({
      id: 'OTP_CREDENTIAL_HARVEST_1',
      step: actions.length + 1,
      action: 'Nikdy nikomu nepřeposílejte SMS kód ani nepotvrzujte neznámé výzvy v bankovní aplikaci',
      rationale: 'Kód nebo potvrzení může povolit přístup či platbu. Žádost ověřte důvěryhodným kanálem.',
      isWarning: true,
    });
  }

  // 5. Podvodné zásilky a clo (Česká pošta, Zásilkovna, DPD) - VYSOKÉ
  const packagePatterns = /\b(balicek nelze dorucit|neuplna adresa|doplatek za doruceni|zaplatte clo|aktualizujte adresu|zasilka byla pozastavena|ceska posta|balikovna|zasilkovna|dpd|gls)\b/i;
  const deliveryDemand = /\b(balicek nelze dorucit|neuplna adresa|doplatek za doruceni|zaplatte clo|aktualizujte adresu|zasilka byla pozastavena)\b/i.test(stripped);
  if (packagePatterns.test(stripped) && deliveryDemand) {
    matches.push({
      ruleId: 'PACKAGE_DELIVERY_SCAM',
      category: 'PACKAGE_DELIVERY',
      severity: 'HIGH',
      title: 'Téma zadržené zásilky / falešného doplatku',
      description: 'Zpráva zmiňuje problém s doručením nebo požadavek na změnu údajů. Podobné formulace se mohou objevit i v podvodných zprávách; ověřte situaci samostatně.',
      snippet: findSnippet(packagePatterns),
      weight: 35,
    });
    actions.push({
      id: 'PACKAGE_DELIVERY_SCAM_1',
      step: actions.length + 1,
      action: 'Otevřete si oficiální web dopravce přímo v prohlížeči (např. ceskaposta.cz)',
      rationale: 'Zadejte číslo zásilky do oficiálního sledování zásilek. Neklikejte na odkaz ve zprávě.',
      isWarning: false,
    });
  }

  // 6. Časový a psychologický nátlak (Urgency) - STŘEDNÍ AŽ VYSOKÉ
  const urgencyPatterns = /\b(okamzit\w*|ihned|do 24 hodin|do 12 hodin|do 2 hodin|posledni vyzva|posledni varovani|exekuce|bude smazan|bude zrusen|sankce|pokuta)\b/i;
  if (urgencyPatterns.test(stripped)) {
    matches.push({
      ruleId: 'PSYCHOLOGICAL_URGENCY',
      category: 'URGENCY_PRESSURE',
      severity: 'HIGH',
      title: 'Agresivní časový nátlak a hrozby',
      description: 'Zpráva používá výrazy jako „okamžitě“, „poslední varování“ nebo vyhrožuje pokutou či zablokováním. Nátlak může ztížit klidné ověření; samotná formulace neprokazuje úmysl odesílatele.',
      snippet: findSnippet(urgencyPatterns),
      weight: 25,
    });
    actions.push({
      id: 'PSYCHOLOGICAL_URGENCY_1',
      step: actions.length + 1,
      action: 'Zastavte se a nenechte se nutit do spěchu',
      rationale: 'Naléhavá lhůta nepotvrzuje pravost žádosti. Dopřejte si čas na ověření důvěryhodným kanálem.',
      isWarning: false,
    });
  }

  // 7. Falešné investice (ČEZ, krypto, AI zhodnocení) - VYSOKÉ
  const investPatterns = /\b(investice do cez|garantovany vynos|zhodnoceni \d+\s*%|investicni robot|kryptomenova platforma|pasivni prijem \d+|statni projekt cez)\b/i;
  if (investPatterns.test(stripped)) {
    matches.push({
      ruleId: 'INVESTMENT_FRAUD_DETECTED',
      category: 'INVESTMENT_FRAUD',
      severity: 'CRITICAL',
      title: 'Příslib nereálného zhodnocení / zneužití značky ČEZ',
      description: 'Text obsahuje formulace spojované s investiční nabídkou či garantovaným výnosem. Výnosy ani tvrzené spojení s institucí nebyly ověřeny.',
      snippet: findSnippet(investPatterns),
      weight: 50,
    });
    actions.push({
      id: 'INVESTMENT_FRAUD_DETECTED_1',
      step: actions.length + 1,
      action: 'Prověřte poskytovatele v seznamu regulovaných subjektů České národní banky (cnb.cz)',
      rationale: 'ČNB vede veřejný registr oprávněných investičních zprostředkovatelů a vydává varování před podvodnými platformami.',
      isWarning: false,
    });
  }

  // 8. Podvody na inzertních portálech (Bazoš, Vinted, Sbazar)
  const marketplacePatterns = /\b(penize jsem odeslal|kuryr si balik vyzvedne|zadejte udaje karty pro prijeti platby|prijmete penize na kartu|kuryrni sluzba vyzvednuti)\b/i;
  if (marketplacePatterns.test(stripped)) {
    matches.push({
      ruleId: 'MARKETPLACE_FRAUD',
      category: 'PAYMENT_DEMAND',
      severity: 'HIGH',
      title: 'Inzertní podvod s falešným kurýrem / přijetím platby',
      description: 'Text odpovídá vzorcům žádostí o platbu nebo kurýrní službu na inzertních portálech. Platbu ověřte přímo v platformě či bance, než sdělíte citlivé údaje.',
      snippet: findSnippet(marketplacePatterns),
      weight: 40,
    });
    actions.push({
      id: 'MARKETPLACE_FRAUD_1',
      step: actions.length + 1,
      action: 'Ověřte platbu přímo v platformě nebo ve své bance',
      rationale: 'Nesdělujte bezpečnostní kód karty ani nepotvrzujte transakci jen proto, že zpráva tvrdí, že je to nutné pro přijetí peněz.',
      isWarning: true,
    });
  }

  return { matches, actions };
}
