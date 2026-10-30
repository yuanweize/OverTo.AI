import type { AnalysisResult } from '@/types/analyzer';
import english from './analysis-en.json';
import type { Locale } from './locale';

/** Localizes authored explanations, never user text, spans, IDs, scores or decisions. */
export function localizeAnalysis(result: AnalysisResult, locale: Locale): AnalysisResult {
  if (locale === 'cs') return { ...result, locale, headline: result.headlineCzech, summary: result.summaryCzech };
  const decision = english.decisions[result.riskLevel];
  const signals: Record<string, { title: string; description: string }> = english.signals;
  const actions: Record<string, { action: string; rationale: string }> = english.actions;
  const explain = (id: string) => signals[id] || signals[id.startsWith('LLM_') ? 'AI' : id.startsWith('IMPERSONATION_') ? 'IMPERSONATION' : 'UNKNOWN'];
  return {
    ...result, locale, headline: decision.title, summary: decision.description,
    evidences: result.evidences.map(evidence => ({ ...evidence, ...explain(evidence.id) })),
    recommendedActions: result.recommendedActions.map(action => ({ ...action, ...(actions[action.id || ''] || actions.INDEPENDENT_VERIFY) })),
    uncertaintyNotice: english.uncertainty,
    semanticAnalysis: result.semanticAnalysis && {
      ...result.semanticAnalysis,
      requestedActions: result.semanticAnalysis.requestedActions.map(action => ({ ...action, description: english.semanticActions[action.type] })),
      riskSignals: result.semanticAnalysis.riskSignals.map(signal => ({ ...signal, explanation: english.signals.AI.description })),
      contextualSummary: english.semanticSummary, missingInformation: [english.semanticMissing], uncertainty: [english.semanticUncertainty],
    },
  };
}
