/**
 * OvěřTo.AI - Privacy-First PII Sanitizer
 * Rediguje osobní a citlivé údaje před zpracováním v pravidlech nebo modelech.
 */

import { RedactedItem } from '@/types/analyzer';
import { extractUrls } from './url-analyzer';

export interface SanitizerResult {
  sanitizedText: string;
  redactedItems: RedactedItem[];
}

export function maskString(str: string): string {
  if (str.length <= 4) return '***';
  return str.slice(0, 2) + '*'.repeat(str.length - 4) + str.slice(-2);
}

export function sanitizeInput(rawText: string): SanitizerResult {
  const redactedItems: RedactedItem[] = [];
  let currentText = rawText;

  // Keep only the host and whether userinfo was present. Paths, query strings,
  // fragments and credentials can contain secrets or tracking identifiers.
  for (const url of extractUrls(currentText)) {
    try {
      const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
      const safeUrl = `${parsed.protocol}//${parsed.username || parsed.password ? 'redacted@' : ''}${parsed.host}/`;
      currentText = currentText.replaceAll(url, (match, offset: number, source: string) =>
        offset > 0 && source[offset - 1] === '@' ? match : safeUrl
      );
    } catch {
      currentText = currentText.replaceAll(url, (match, offset: number, source: string) =>
        offset > 0 && source[offset - 1] === '@' ? match : '[ODKAZ]'
      );
    }
  }

  // 1. Platební karty (13 až 19 číslic s volitelnými mezerami či pomlčkami)
  const cardRegex = /\b(?:\d{4}[ -]?){3}\d{1,4}\b/g;
  currentText = currentText.replace(cardRegex, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
      redactedItems.push({
        type: 'CARD',
        originalMasked: maskString(match),
        placeholder: '[ČÍSLO PLATEBNÍ KARTY]',
      });
      return '[ČÍSLO PLATEBNÍ KARTY]';
    }
    return match;
  });

  // 2. České rodné číslo (RRMMDD/XXXX nebo RRMMDDXXXX)
  const rcRegex = /\b\d{2}[0156]\d[0-3]\d\/?\d{3,4}\b/g;
  currentText = currentText.replace(rcRegex, (match) => {
    redactedItems.push({
      type: 'RC',
      originalMasked: maskString(match),
      placeholder: '[RODNÉ ČÍSLO]',
    });
    return '[RODNÉ ČÍSLO]';
  });

  // 3. IBAN a české bankovní účty (CZkk bbbb ssss ssčč čččč nebo prefix-číslo/kód)
  const ibanRegex = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi;
  currentText = currentText.replace(ibanRegex, (match) => {
    redactedItems.push({
      type: 'IBAN',
      originalMasked: maskString(match),
      placeholder: '[IBAN ÚČET]',
    });
    return '[IBAN ÚČET]';
  });

  const czAccountRegex = /\b(?:\d{1,6}-)?\d{2,10}\/(?:0100|0300|0600|0710|0800|2010|2060|2070|2100|2200|2220|2240|2250|2260|2600|2700|3030|3050|3060|4000|4300|5500|5800|6000|6100|6200|6210|6300|6700|6800|7910|7950|7960|7970|7980|7990|8030|8040|8060|8090|8150|8200|8215|8220|8225|8230|8240|8250|8255|8260|8265|8270|8272|8280|8283|8290|8294|8296)\b/g;
  currentText = currentText.replace(czAccountRegex, (match) => {
    redactedItems.push({
      type: 'IBAN',
      originalMasked: maskString(match),
      placeholder: '[BANKOVNÍ ÚČET]',
    });
    return '[BANKOVNÍ ÚČET]';
  });

  // 4. E-mailové adresy
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  currentText = currentText.replace(emailRegex, (match, offset: number, source: string) => {
    if (source.slice(Math.max(0, offset - 2), offset) === '//') return match;
    redactedItems.push({
      type: 'EMAIL',
      originalMasked: maskString(match),
      placeholder: '[E-MAIL]',
    });
    return '[E-MAIL]';
  });

  // 5. Telefonní čísla (česká +420... nebo 9místná se standardními předvolbami)
  const phoneRegex = /(?:\+420\s?)?[67]\d{2}\s?\d{3}\s?\d{3}\b/g;
  currentText = currentText.replace(phoneRegex, (match) => {
    redactedItems.push({
      type: 'PHONE',
      originalMasked: maskString(match),
      placeholder: '[TELEFONNÍ ČÍSLO]',
    });
    return '[TELEFONNÍ ČÍSLO]';
  });

  // 6. Explicitní autorizační kódy (např. Kód: 123456 nebo PIN: 1234)
  const otpRegex = /(?:kód|kod|heslo|pin|otp|token)[:\s]+([0-9]{4,8})\b/gi;
  currentText = currentText.replace(otpRegex, (_match, code) => {
    redactedItems.push({
      type: 'RC',
      originalMasked: maskString(code),
      placeholder: '[AUTORIZAČNÍ KÓD]',
    });
    return `kód: [AUTORIZAČNÍ KÓD]`;
  });

  return {
    sanitizedText: currentText,
    redactedItems,
  };
}
