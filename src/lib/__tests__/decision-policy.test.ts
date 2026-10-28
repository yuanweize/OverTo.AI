import { describe, it, expect } from 'vitest';
import { decideRisk } from '@/fraud-engine/decision-policy';
import type { RiskEvidence } from '@/types/analyzer';
const signal: RiskEvidence = { id: 'a', category: 'URGENCY_PRESSURE', severity: 'HIGH', title: '', description: '' };
describe('risk decision policy', () => {
  it('does not escalate repeated signals of the same type', () => {
    expect(decideRisk([signal, { ...signal, id: 'b' }], false)).toBe('VERIFICATION_RECOMMENDED');
  });
  it('elevates independent high categories and never downgrades a critical signal', () => {
    expect(decideRisk([signal, { ...signal, category: 'OTP_THEFT' }], false)).toBe('HIGH_RISK');
    expect(decideRisk([{ ...signal, severity: 'CRITICAL' }], false)).toBe('HIGH_RISK');
  });
  it('abstains when there is no evidence and suggests checking a link', () => {
    expect(decideRisk([], false)).toBe('INSUFFICIENT_EVIDENCE');
    expect(decideRisk([], true)).toBe('VERIFICATION_RECOMMENDED');
  });
});
