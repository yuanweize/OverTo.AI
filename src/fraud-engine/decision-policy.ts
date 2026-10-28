import type { RiskEvidence, RiskLevel } from '@/types/analyzer';

/** Conservative heuristic, not a calibrated probability or independently validated policy. */
export function decideRisk(evidence: RiskEvidence[], hasUrl: boolean): RiskLevel {
  if (evidence.some(item => item.severity === 'CRITICAL')) return 'HIGH_RISK';
  // Repeated signals in the same category cannot independently raise the level.
  const highCategories = new Set(evidence.filter(item => item.severity === 'HIGH').map(item => item.category));
  if (highCategories.size >= 2) return 'HIGH_RISK';
  if (highCategories.size > 0 || evidence.some(item => item.severity === 'MEDIUM') || hasUrl) return 'VERIFICATION_RECOMMENDED';
  return 'INSUFFICIENT_EVIDENCE';
}
