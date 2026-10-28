/**
 * OvěřTo.AI - Deterministic URL & Domain Security Analyzer
 * Analyzuje webové odkazy na přítomnost podvodných vzorců, homoglyfů,
 * matoucích subdomén a impersonace českých institucí.
 * 
 * ZÁSADA: Nikdy neprovádí aktivní HTTP dotazy na zadané URL (ochrana proti SSRF a sledování).
 */

import { RiskEvidence } from '@/types/analyzer';
import { getDomain } from 'tldts';

export interface UrlAnalysisResult {
  hasUrl: boolean;
  urlsFound: string[];
  evidences: RiskEvidence[];
  suspiciousScore: number;
}

// Mapa legitimních českých domén
const LEGITIMATE_CZECH_DOMAINS: Record<string, string[]> = {
  ceskaposta: ['ceskaposta.cz', 'cpost.cz', 'postaonline.cz'],
  balikovna: ['balikovna.cz'],
  zasilkovna: ['zasilkovna.cz', 'packeta.cz'],
  packeta: ['packeta.cz', 'zasilkovna.cz'],
  csas: ['csas.cz', 'george.csas.cz'],
  csob: ['csob.cz'],
  kb: ['kb.cz', 'mojebanka.cz'],
  airbank: ['airbank.cz'],
  fio: ['fio.cz'],
  moneta: ['moneta.cz'],
  rb: ['rb.cz'],
  financnisprava: ['financnisprava.cz', 'mojedane.cz'],
  gov: ['gov.cz'],
  cez: ['cez.cz', 'cezdistribuce.cz'],
  policie: ['policie.cz'],
};

// Známé zkracovače odkazů
const KNOWN_SHORTENERS = [
  'bit.ly', 'tinyurl.com', 'is.gd', 'cutt.ly', 't.co', 'rb.gy',
  'shorturl.at', 'ow.ly', 'buff.ly', 'goo.gl', 'rebrand.ly'
];

// Homoglyfy (azbuka zaměňovaná za latinku)
const HOMOGLYPH_MAP: Record<string, string> = {
  '\u0430': 'a', // cyrillic small a
  '\u0435': 'e', // cyrillic small e
  '\u043E': 'o', // cyrillic small o
  '\u0440': 'p', // cyrillic small r
  '\u0441': 'c', // cyrillic small s
  '\u0443': 'y', // cyrillic small u
  '\u0445': 'x', // cyrillic small ha
  '\u0456': 'i', // cyrillic small byelorussian-ukrainian i
};

export function extractUrls(text: string): string[] {
  // Include query and fragment even for scheme-less links so privacy processing
  // cannot accidentally leave tokens behind. Never treat an email domain as a URL.
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`]+|(?<![@\p{L}\p{N}_-])(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,63}(?:[/?#][^\s<>"'{}|\\^`]*)?/giu;
  const matches = text.match(urlRegex) || [];
  return Array.from(new Set(matches.map(u => u.trim().replace(/[.,;:!?]+$/, ''))));
}

export function parseHostname(rawUrl: string): string | null {
  try {
    const withProto = /^https?:\/\//i.test(rawUrl) ? rawUrl : `http://${rawUrl}`;
    const parsed = new URL(withProto);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function analyzeUrls(text: string): UrlAnalysisResult {
  const urls = extractUrls(text);
  const evidences: RiskEvidence[] = [];
  let suspiciousScore = 0;

  if (urls.length === 0) {
    return { hasUrl: false, urlsFound: [], evidences, suspiciousScore: 0 };
  }

  for (const url of urls) {
    const hostname = parseHostname(url);
    if (!hostname) continue;

    try {
      const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
      if (parsed.username || parsed.password) {
        evidences.push({ id: 'URL_USERINFO', category: 'SUSPICIOUS_URL', severity: 'HIGH', title: 'Adresa obsahuje část před zavináčem', description: `Skutečný hostitel je ${hostname}; část před @ není doména. Ověřte adresu nezávisle.`, matchedSnippet: url });
        suspiciousScore += 30;
      }
    } catch { continue; }

    // 1. Detekce IP adresy místo doménového jména
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || (hostname.startsWith('[') && hostname.endsWith(']'))) {
      evidences.push({
        id: 'URL_IP_ADDRESS',
        category: 'SUSPICIOUS_URL',
        severity: 'CRITICAL',
        title: 'Odkaz směřuje na přímou IP adresu',
        description: `Odkaz (${hostname}) používá číselnou IP adresu namísto oficiální domény. Jde o typický znak podvodných serverů.`,
        matchedSnippet: url,
      });
      suspiciousScore += 45;
    }

    // 2. Detekce zkracovačů odkazů
    if (KNOWN_SHORTENERS.some(s => hostname === s || hostname.endsWith(`.${s}`))) {
      evidences.push({
        id: 'URL_SHORTENER',
        category: 'SUSPICIOUS_URL',
        severity: 'HIGH',
        title: 'Skrytý cíl odkazu (zkracovač)',
        description: `Odkaz využívá zkracovací službu (${hostname}), která maskuje skutečný cílový server. Útočníci tak obcházejí filtry.`,
        matchedSnippet: url,
      });
      suspiciousScore += 30;
    }

    // 3. Detekce Punycode / IDN a homoglyfů
    if (hostname.includes('xn--')) {
      evidences.push({
        id: 'URL_PUNYCODE',
        category: 'SUSPICIOUS_URL',
        severity: 'MEDIUM',
        title: 'Mezinárodní doména (Punycode)',
        description: `Doména používá mezinárodní znaky. To samo o sobě není znak podvodu; ověřte správný název.`,
        matchedSnippet: url,
      });
      suspiciousScore += 10;
    }

    for (const [char, replacement] of Object.entries(HOMOGLYPH_MAP)) {
      if (url.includes(char)) {
        evidences.push({
          id: 'URL_HOMOGLYPH_CHAR',
          category: 'SUSPICIOUS_URL',
          severity: 'MEDIUM',
          title: 'Cizí znak v textu adresy',
          description: `V adrese byl detekován znak azbuky '${char}', který může připomínat latinské '${replacement}'. Může jít i o běžný mezinárodní název.`,
          matchedSnippet: url,
        });
        suspiciousScore += 10;
        break;
      }
    }

    // 5. Kontrola impersonace známých českých značek
    for (const [brand, legitDomains] of Object.entries(LEGITIMATE_CZECH_DOMAINS)) {
      // Obsahuje název značky kdekoliv v hostu
      if (hostname.split('.').some(label => brand.length <= 3 ? label === brand : label.includes(brand))) {
        const isLegit = legitDomains.some(d => hostname === d || hostname.endsWith(`.${d}`));
        if (!isLegit) {
          evidences.push({
            id: `IMPERSONATION_${brand.toUpperCase()}`,
            category: 'IMPERSONATION',
            severity: 'CRITICAL',
            title: `Napodobení oficiální adresy (${brand})`,
            description: `Adresa obsahuje název '${brand}', ale neodpovídá skutečné oficiální doméně (${legitDomains.join(', ')}). Může jít o napodobení; samotná adresa podvod nedokazuje.`,
            matchedSnippet: url,
          });
          suspiciousScore += 55;
        }
      }
    }

    // Public Suffix List aware: last two labels are not always a registrable domain.
    const registered = getDomain(hostname, { allowPrivateDomains: true });
    if (registered && hostname.endsWith(`.${registered}`)) {
      const subdomains = hostname.slice(0, -(registered.length + 1));
      if (/(posta|bank|platba)/i.test(subdomains)) {
        evidences.push({
          id: 'URL_MISLEADING_SUBDOMAIN', category: 'SUSPICIOUS_URL', severity: 'HIGH',
          title: 'Název služby v subdoméně',
          description: `Hostitel '${hostname}' obsahuje '${subdomains}' před registrovatelnou doménou '${registered}'. To není důkaz podvodu; provozovatele ověřte nezávisle.`,
          matchedSnippet: url,
        });
        suspiciousScore += 35;
      }
    }
  }

  return {
    hasUrl: true,
    urlsFound: urls,
    evidences,
    suspiciousScore: Math.min(suspiciousScore, 100),
  };
}
