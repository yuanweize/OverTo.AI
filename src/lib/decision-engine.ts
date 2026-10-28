/**
 * OvěřTo.AI - Core Decision & Evidence Aggregation Engine
 * Sjednocuje výstupy sanitizéru, URL analyzátoru, deterministických pravidel
 * a volitelného LLM modulu do jednotného strukturovaného výsledku.
 */

import { AnalysisResult, RiskLevel, RiskEvidence, VerificationAction } from '@/types/analyzer';
import { sanitizeInput } from './sanitizer';
import { analyzeUrls } from './url-analyzer';
import { evaluateDeterministicRules } from './rules-engine';
import { runLlmAnalysisIfConfigured, type ProviderResult } from './llm-adapter';
import { decideRisk } from '@/fraud-engine/decision-policy';

export async function analyzeSuspiciousMessage(rawText: string, enableLlm: boolean = false): Promise<AnalysisResult> {
  const startTime = Date.now();

  // 1. Ochrana soukromí - PII Sanitizace
  const { sanitizedText, redactedItems } = sanitizeInput(rawText);

  // 2. Deterministická analýza odkazů a domén
  const urlResult = analyzeUrls(sanitizedText);

  // 3. Deterministická analýza textových vzorců podvodů
  const ruleResult = evaluateDeterministicRules(sanitizedText);

  // Sloučení všech deterministických důkazů
  const combinedEvidences: RiskEvidence[] = [...urlResult.evidences];
  for (const m of ruleResult.matches) {
    combinedEvidences.push({
      id: m.ruleId,
      category: m.category,
      severity: m.severity,
      title: m.title,
      description: m.description,
      matchedSnippet: m.snippet,
    });
  }

  // Akční kroky
  const combinedActions: VerificationAction[] = [...ruleResult.actions];

  // Pokud odkaz obsahuje podvod, přidáme specifické kroky pro URL
  if (urlResult.hasUrl && urlResult.suspiciousScore > 30) {
    combinedActions.unshift({
      step: 1,
      action: 'V žádném případě na odkaz v této zprávě neklikejte',
      rationale: 'Odkaz vykazuje znaky podvržené domény. Může vést na podvodnou platební bránu nebo instalaci škodlivého kódu.',
      isWarning: true,
    });
  }

  // 4. Volitelné zapojení LLM vrstvy (pokud je povoleno a nakonfigurováno)
  let engineType: 'HYBRID_RULES_AND_LLM' | 'DETERMINISTIC_RULES' = 'DETERMINISTIC_RULES';
  let aiResult: ProviderResult = { status: 'NOT_REQUESTED' };
  if (enableLlm) {
    aiResult = await runLlmAnalysisIfConfigured(sanitizedText);
    if (aiResult.status === 'SUCCESS' && aiResult.analysis) {
      engineType = 'HYBRID_RULES_AND_LLM';
      for (const [index, signal] of aiResult.analysis.riskSignals.entries()) {
        combinedEvidences.push({ id: `LLM_${signal.category}_${index}`, category: signal.category,
          severity: signal.severity, title: 'Možný signál podle AI', description: signal.explanation,
          matchedSnippet: signal.evidenceText });
      }
    }
  }

  // 5. Výpočet celkového skóre rizika a klasifikace
  let calculatedScore = 0;
  for (const ev of combinedEvidences) {
    if (ev.severity === 'CRITICAL') calculatedScore += 45;
    else if (ev.severity === 'HIGH') calculatedScore += 30;
    else if (ev.severity === 'MEDIUM') calculatedScore += 15;
    else calculatedScore += 5;
  }
  calculatedScore += urlResult.suspiciousScore;
  // An unverified link warrants an independent check, not a claim of malice.
  if (urlResult.hasUrl && calculatedScore === 0) calculatedScore = 5;
  const finalRiskScore = Math.min(Math.max(calculatedScore, 0), 100);

  // Bezpečnostní rozhodovací matice (Safety Guardrail)
  let riskLevel: RiskLevel = 'INSUFFICIENT_EVIDENCE';
  let headlineCzech = '';
  let summaryCzech = '';

  const policyDecision = decideRisk(combinedEvidences, urlResult.hasUrl);

  if (policyDecision === 'HIGH_RISK') {
    riskLevel = 'HIGH_RISK';
    headlineCzech = 'Vysoké riziko podvodu a manipulace';
    summaryCzech = 'Zpráva obsahuje možné rizikové signály. Před jakoukoli platbou nebo sdílením údajů situaci nezávisle ověřte; samotný výsledek podvod nedokazuje.';
  } else if (policyDecision === 'VERIFICATION_RECOMMENDED') {
    riskLevel = 'VERIFICATION_RECOMMENDED';
    headlineCzech = 'Doporučeno zvýšené prověření';
    summaryCzech = 'Ve zprávě byly nalezeny podezřelé prvky nebo neověřený odkaz. Nejedná se nutně o prokázaný podvod, ale před jakoukoliv akcí důrazně doporučujeme provést nezávislé ověření.';
  } else {
    riskLevel = 'INSUFFICIENT_EVIDENCE';
    headlineCzech = 'Nezjištěny typické znaky podvodu';
    summaryCzech = 'V zadaném textu nebyly automaticky detekovány běžné indikátory phishingu ani nátlaku. To však neznamená, že je zpráva zaručeně bezpečná. Pokud vás žádá o neobvyklou akci, ověřte si ji.';
  }

  // Standardní verifikační krok, pokud žádné akce nevznikly
  if (combinedActions.length === 0) {
    combinedActions.push({
      step: 1,
      action: 'Ověřte si odesílatele nezávislým oficiálním kanálem',
      rationale: 'Pokud zpráva požaduje jakoukoliv reakci, nepoužívejte kontakty uvedené ve zprávě, ale oficiální web či známé telefonní číslo.',
      isWarning: false,
    });
  }

  // Přečíslování kroků
  const normalizedActions = combinedActions.map((act, index) => ({
    ...act,
    step: index + 1,
  }));

  const detectedCategories = Array.from(new Set(combinedEvidences.map(e => e.category)));

  const processingTimeMs = Date.now() - startTime;

  return {
    riskLevel,
    riskScore: finalRiskScore,
    headlineCzech,
    summaryCzech,
    evidences: combinedEvidences,
    recommendedActions: normalizedActions,
    sanitizedText,
    redactedCount: redactedItems.length,
    detectedCategories,
    safeDecisionGuarantee: false,
    uncertaintyNotice: 'Upozornění: Žádný automatizovaný systém ani AI nemůže stoprocentně zaručit bezpečnost neznámé komunikace. OvěřTo.AI poskytuje podporu pro vaše rozhodování, nikoliv právní či certifikační záruku.',
    semanticAnalysis: aiResult.analysis,
    metadata: {
      aiStatus: aiResult.status,
      aiReason: aiResult.reason,
      aiProvider: aiResult.status === 'SUCCESS' ? 'AI' : null,
      aiModel: aiResult.model,
      rejectedAiEvidence: aiResult.rejectedEvidence,
      analyzedAt: new Date().toISOString(),
      engine: engineType,
      processingTimeMs,
      ruleMatches: combinedEvidences.length,
    },
  };
}
