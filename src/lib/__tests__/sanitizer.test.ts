import { describe, it, expect } from 'vitest';
import { sanitizeInput } from '../sanitizer';

describe('Privacy-First PII Sanitizer', () => {
  it('masks Czech Rodné číslo (birth numbers)', () => {
    const input = 'Moje rodné číslo je 850123/1234 a manželky 9055121234.';
    const result = sanitizeInput(input);
    expect(result.sanitizedText).not.toContain('850123/1234');
    expect(result.sanitizedText).not.toContain('9055121234');
    expect(result.redactedItems.length).toBe(2);
    expect(result.redactedItems[0].type).toBe('RC');
  });

  it('masks payment card numbers', () => {
    const input = 'Zadejte kartu 4532 1234 5678 9010 pro ověření.';
    const result = sanitizeInput(input);
    expect(result.sanitizedText).not.toContain('4532 1234 5678 9010');
    expect(result.sanitizedText).toContain('[ČÍSLO PLATEBNÍ KARTY]');
    expect(result.redactedItems.some(i => i.type === 'CARD')).toBe(true);
  });

  it('masks Czech bank account and IBAN', () => {
    const input = 'Peníze pošlete na účet 19-1234567890/0800 nebo IBAN CZ6508000000191234567890.';
    const result = sanitizeInput(input);
    expect(result.sanitizedText).not.toContain('19-1234567890/0800');
    expect(result.sanitizedText).not.toContain('CZ6508000000191234567890');
    expect(result.redactedItems.filter(i => i.type === 'IBAN').length).toBe(2);
  });

  it('masks phone numbers and emails', () => {
    const input = 'Kontaktujte mě na +420 777 123 456 nebo novak@seznam.cz.';
    const result = sanitizeInput(input);
    expect(result.sanitizedText).not.toContain('+420 777 123 456');
    expect(result.sanitizedText).not.toContain('novak@seznam.cz');
    expect(result.redactedItems.some(i => i.type === 'PHONE')).toBe(true);
    expect(result.redactedItems.some(i => i.type === 'EMAIL')).toBe(true);
  });

  it('keeps the host and userinfo warning while removing URL secrets', () => {
    const result = sanitizeInput('Otevřete https://user:password@attacker.example/reset/secret?token=123#key');
    expect(result.sanitizedText).toContain('https://redacted@attacker.example/');
    expect(result.sanitizedText).not.toMatch(/password|secret|token|123|#key/);
  });

  it('masks explicit OTP and authorization codes', () => {
    const input = 'Váš jednorázový kód: 948215 pro potvrzení transakce.';
    const result = sanitizeInput(input);
    expect(result.sanitizedText).not.toContain('948215');
    expect(result.sanitizedText).toContain('[AUTORIZAČNÍ KÓD]');
  });
  it('removes query and fragment from scheme-less URLs without damaging emails', () => {
    const result = sanitizeInput('Email jan@example.com, odkaz example.com?token=abc#private');
    expect(result.sanitizedText).not.toContain('jan@example.com');
    expect(result.sanitizedText).not.toMatch(/token|abc|private/);
    expect(result.sanitizedText).toContain('https://example.com/');
  });

});
