import { defaultProviderSettings, type ProviderSettings } from '@/ai/providers-config';
import { analyzeSuspiciousMessage } from '@/lib/decision-engine';
import { runLlmAnalysisIfConfigured } from '@/lib/llm-adapter';
import { sanitizeInput } from '@/lib/sanitizer';
import { decideRisk } from '@/fraud-engine/decision-policy';
import { CHALLENGE_SET } from '@/evaluation/challenge-dataset';
import type { RuntimePrompt } from '@/ai/prompts/default';
import type { RiskLevel } from '@/types/analyzer';
export type EvaluationMode='RULES_ONLY'|'LLM_ONLY'|'HYBRID_AI';
export type EvaluationRow={caseId:string;truth:string;decision:RiskLevel|null;status:string;durationMs:number;inputTokens:number|null;outputTokens:number|null;rejectedEvidence:number|null};
export function summarizeEvaluation(rows:EvaluationRow[]) {
  const completed=rows.filter(row=>row.decision!==null);
  const count=(truth:string,positive:boolean)=>completed.filter(row=>row.truth===truth&&(row.decision==='HIGH_RISK')===positive).length;
  const tp=count('MALICIOUS',true),fn=count('MALICIOUS',false),fp=count('BENIGN',true),tn=count('BENIGN',false);
  return {attempted:rows.length,completed:completed.length,failed:rows.length-completed.length,truePositive:tp,falseNegative:fn,falsePositive:fp,trueNegative:tn,
    falsePositiveRate:fp+tn?fp/(fp+tn):null,falseNegativeRate:tp+fn?fn/(tp+fn):null,
    abstentions:completed.filter(row=>row.decision==='INSUFFICIENT_EVIDENCE').length};
}
export async function runEvaluation(mode:EvaluationMode,prompt:RuntimePrompt,limit:number,settings:ProviderSettings=defaultProviderSettings()):Promise<EvaluationRow[]> {
  if (!['RULES_ONLY','LLM_ONLY','HYBRID_AI'].includes(mode)||!Number.isInteger(limit)||limit<1||limit>CHALLENGE_SET.length||mode!=='RULES_ONLY'&&limit>4) throw new Error('INVALID_EVALUATION');
  const rows:EvaluationRow[]=[];
  for(const item of CHALLENGE_SET.slice(0,limit)) {
    const input=sanitizeInput(item.text).sanitizedText;
    const start=Date.now();
    if(mode==='LLM_ONLY') {
      const result=await runLlmAnalysisIfConfigured(input,prompt,settings);
      const evidences=result.analysis?.riskSignals.map((signal,index)=>({id:`LLM_${index}`,category:signal.category,severity:signal.severity,title:'',description:'',matchedSnippet:signal.evidenceText}))??[];
      rows.push({caseId:item.id,truth:item.truth,decision:result.status==='SUCCESS'?decideRisk(evidences,false):null,status:result.status,durationMs:Date.now()-start,inputTokens:result.inputTokens??null,outputTokens:result.outputTokens??null,rejectedEvidence:result.rejectedEvidence??null});
    } else {
      const result=await analyzeSuspiciousMessage(input,mode==='HYBRID_AI','cs',prompt,settings);
      const status=mode==='RULES_ONLY'?'SUCCESS':result.metadata.aiStatus;
      rows.push({caseId:item.id,truth:item.truth,decision:status==='SUCCESS'?result.riskLevel:null,status,durationMs:Date.now()-start,inputTokens:result.metadata.inputTokens??null,outputTokens:result.metadata.outputTokens??null,rejectedEvidence:result.metadata.rejectedAiEvidence??null});
    }
  }
  return rows;
}
