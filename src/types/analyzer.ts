import type { AiStatus, SemanticAnalysis } from '@/lib/llm-adapter';

/**
 * OvěřTo.AI - Data Models and Type Definitions
 * AI výzva pro Česko 2026
 */

export type RiskLevel =
  | 'HIGH_RISK'                // Vysoké riziko podvodu / manipulace
  | 'VERIFICATION_RECOMMENDED' // Doporučeno obezřetné nezávislé ověření
  | 'INSUFFICIENT_EVIDENCE';   // Nedostatek informací k posouzení (stále nutná opatrnost)

export type ScamCategory =
  | 'IMPERSONATION'       // Vydávání se za instituci, banku, poštu, úřad
  | 'URGENCY_PRESSURE'    // Časový nebo psychologický nátlak
  | 'PAYMENT_DEMAND'      // Požadavek na platbu, clo, převod peněz
  | 'CREDENTIAL_THEFT'    // Kradení přihlašovacích údajů, hesel, PIN
  | 'OTP_THEFT'           // Vylákání SMS autorizačních kódů / klíče
  | 'REMOTE_ACCESS'       // Požadavek na instalaci AnyDesk, TeamViewer apod.
  | 'SUSPICIOUS_URL'      // Podvodná, překlepová nebo matoucí doména
  | 'FAMILY_EMERGENCY'    // Podvod „falešný syn/dcera v nouzi“
  | 'PACKAGE_DELIVERY'    // Podvod s fiktivní zásilkou (Česká pošta, DPD...)
  | 'INVESTMENT_FRAUD';   // Falešné investice (ČEZ, krypto, zázračné zhodnocení)

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface RiskEvidence {
  id: string;
  category: ScamCategory;
  severity: Severity;
  title: string;
  description: string;
  matchedSnippet?: string;
}

export type RedactedType = 'PHONE' | 'EMAIL' | 'IBAN' | 'CARD' | 'RC' | 'URL';

export interface RedactedItem {
  type: RedactedType;
  originalMasked: string;
  placeholder: string;
}

export interface VerificationAction {
  step: number;
  action: string;
  rationale: string;
  isWarning: boolean;
}

export interface AnalysisResult {
  riskLevel: RiskLevel;
  riskScore: number; // 0 až 100
  summaryCzech: string;
  headlineCzech: string;
  evidences: RiskEvidence[];
  recommendedActions: VerificationAction[];
  sanitizedText: string;
  redactedCount: number;
  detectedCategories: ScamCategory[];
  safeDecisionGuarantee: false; // Explicitní záruka: NIKDY neslibujeme 100% bezpečí
  uncertaintyNotice: string;
  semanticAnalysis?: SemanticAnalysis;
  metadata: {
    analyzedAt: string;
    engine: 'HYBRID_RULES_AND_LLM' | 'DETERMINISTIC_RULES';
    aiStatus: AiStatus;
    aiProvider: 'OpenAI' | null;
    aiModel?: string;
    rejectedAiEvidence?: number;
    processingTimeMs: number;
    ruleMatches: number;
  };
}

export interface AnalyzeRequest {
  text: string;
  contextHint?: 'SMS' | 'EMAIL' | 'WHATSAPP' | 'WEB' | 'UNKNOWN';
  enableLlm?: boolean;
  aiConsent?: boolean;
}

export interface DemoScenario {
  id: string;
  title: string;
  subtitle: string;
  category: ScamCategory | 'BENIGN' | 'AMBIGUOUS';
  expectedRiskLevel: RiskLevel;
  sourceType: 'SMS' | 'EMAIL' | 'WHATSAPP';
  sampleText: string;
  explanation: string;
}
