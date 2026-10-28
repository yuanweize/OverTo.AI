import { describe, it, expect } from 'vitest';
import { evaluateDeterministicRules } from '../rules-engine';

describe('Deterministic Rules Engine', () => {
  it('detects AnyDesk remote access demand', () => {
    const text = 'Nainstalujte si aplikaci AnyDesk pro zabezpečení účtu.';
    const { matches, actions } = evaluateDeterministicRules(text);
    expect(matches.some(m => m.category === 'REMOTE_ACCESS')).toBe(true);
    expect(matches.some(m => m.severity === 'CRITICAL')).toBe(true);
    expect(actions.some(a => a.isWarning)).toBe(true);
  });

  it('detects fake banker safe account tactic', () => {
    const text = 'Váš účet byl napaden. Převeďte peníze na bezpečný účet.';
    const { matches, actions } = evaluateDeterministicRules(text);
    expect(matches.some(m => m.ruleId === 'SAFE_ACCOUNT_FRAUD')).toBe(true);
    expect(actions.some(a => a.action.includes('platební kartu'))).toBe(true);
  });

  it('detects WhatsApp family emergency scam', () => {
    const text = 'Ahoj mami, starý telefon mi spadl do vody, tohle je nové číslo. Potřebuji nutně zaplatit nájem.';
    const { matches, actions } = evaluateDeterministicRules(text);
    expect(matches.some(m => m.category === 'FAMILY_EMERGENCY')).toBe(true);
    expect(actions.some(a => a.action.includes('PŮVODNÍ'))).toBe(true);
  });

  it('warns about a family payment request with changed contact', () => {
    for (const text of [
      'Ahoj mami, starý telefon mi včera spadl do vody. Mám nové dočasné číslo. Musím dnes zaplatit nájem. Můžeš to prosím poslat za mě na účet?',
      'Ahoj tati, mám nové číslo. Pošli mi ihned 20 000 Kč.',
    ]) {
      expect(evaluateDeterministicRules(text).matches.some(m => m.ruleId === 'FAMILY_EMERGENCY_SCAM' && m.severity === 'CRITICAL')).toBe(true);
    }
  });

  it('does not interpret ordinary greetings, information, or negative payment instructions as a family scam', () => {
    for (const text of [
      'Ahoj mami, jak se máš? Mám tě ráda.',
      'Ahoj tati, mám nové číslo, těším se na návštěvu.',
      'Ahoj mami, mám nové číslo, ale peníze mi neposílej.',
      'Ahoj mami, mám nové číslo. Prosím neposílej mi peníze na účet.',
    ]) {
      expect(evaluateDeterministicRules(text).matches.some(m => m.ruleId === 'FAMILY_EMERGENCY_SCAM')).toBe(false);
    }
  });

  it('detects fake ČEZ investment promise', () => {
    const text = 'Garantovaný výnos 45 % měsíčně z investice do ČEZ přes AI platformu.';
    const { matches } = evaluateDeterministicRules(text);
    expect(matches.some(m => m.category === 'INVESTMENT_FRAUD')).toBe(true);
  });

  it('handles benign text with 0 scam matches', () => {
    const text = 'Ahoj, sejdeme se zítra v 15:00 na kávě v kavárně.';
    const { matches } = evaluateDeterministicRules(text);
    expect(matches.length).toBe(0);
  });
});
