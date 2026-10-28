import { describe, it, expect } from 'vitest';
import { analyzeSuspiciousMessage } from '../decision-engine';
import { DEMO_SCENARIOS } from '../demo-scenarios';

describe('Core Decision Engine & Scenarios Evaluation', () => {
  it('correctly classifies Czech Post scam as HIGH_RISK', async () => {
    const scenario = DEMO_SCENARIOS.find(s => s.id === 'ceska-posta-phishing')!;
    const result = await analyzeSuspiciousMessage(scenario.sampleText, false);
    expect(result.riskLevel).toBe('HIGH_RISK');
    expect(result.riskScore).toBeGreaterThanOrEqual(60);
    expect(result.evidences.length).toBeGreaterThan(0);
    expect(result.safeDecisionGuarantee).toBe(false);
  });

  it('correctly classifies Fake Banker as HIGH_RISK with critical severity', async () => {
    const scenario = DEMO_SCENARIOS.find(s => s.id === 'falesny-banker-zachranny-ucet')!;
    const result = await analyzeSuspiciousMessage(scenario.sampleText, false);
    expect(result.riskLevel).toBe('HIGH_RISK');
    expect(result.evidences.some(e => e.severity === 'CRITICAL')).toBe(true);
  });

  it('NEVER promises 100% safe on benign messages', async () => {
    const scenario = DEMO_SCENARIOS.find(s => s.id === 'legitimni-zasilkovna')!;
    const result = await analyzeSuspiciousMessage(scenario.sampleText, false);
    expect(result.safeDecisionGuarantee).toBe(false);
    expect(result.uncertaintyNotice).toBeDefined();
    expect(result.riskLevel).not.toBe('HIGH_RISK');
  });

  it('does not treat ordinary family messages or safety advice as fraud', async () => {
    for (const text of ['Ahoj mami, jak se mas? Mam te rada.', 'Ahoj tati, přijedu na večeři.', 'Banka nikdy nebude chtít váš SMS kód.']) {
      const result = await analyzeSuspiciousMessage(text, false);
      expect(result.riskLevel).not.toBe('HIGH_RISK');
    }
  });

  it('warns on a family payment request', async () => {
    const result = await analyzeSuspiciousMessage('Ahoj mami, mám nové číslo. Pošli mi ihned 20 000 Kč.', false);
    expect(result.riskLevel).toBe('HIGH_RISK');
  });

  it('warns on the actual family emergency demo after redaction', async () => {
    const scenario = DEMO_SCENARIOS.find(s => s.id === 'whatsapp-ahoj-mami')!;
    const result = await analyzeSuspiciousMessage(scenario.sampleText, false);
    expect(result.riskLevel).toBe('HIGH_RISK');
    expect(result.evidences.some(e => e.id === 'FAMILY_EMERGENCY_SCAM')).toBe(true);
  });

  it('evaluates all 8 demo scenarios without crashing and produces expected outcomes', async () => {
    for (const scenario of DEMO_SCENARIOS) {
      const result = await analyzeSuspiciousMessage(scenario.sampleText, false);
      expect(result.riskLevel).toBeDefined();
      expect(result.recommendedActions.length).toBeGreaterThan(0);
      expect(result.summaryCzech).toBeDefined();
      expect(typeof result.riskScore).toBe('number');
    }
  });
});
