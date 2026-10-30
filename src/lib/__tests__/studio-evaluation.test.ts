import {describe,it,expect} from 'vitest';
import {runEvaluation,summarizeEvaluation,type EvaluationRow} from '@/ai/evaluations/runner';
import {defaultPrompt} from '@/ai/prompts/default';
import {CHALLENGE_SET} from '@/evaluation/challenge-dataset';
describe('studio evaluation accounting',()=>{
  it('excludes unavailable responses and ambiguous truth from binary denominators',()=>{
    const row=(truth:string,decision:EvaluationRow['decision']):EvaluationRow=>({caseId:'synthetic',truth,decision,status:decision?'SUCCESS':'FAILED',durationMs:1,inputTokens:null,outputTokens:null,rejectedEvidence:null});
    expect(summarizeEvaluation([row('MALICIOUS','HIGH_RISK'),row('MALICIOUS','INSUFFICIENT_EVIDENCE'),row('BENIGN','HIGH_RISK'),row('BENIGN',null),row('AMBIGUOUS','HIGH_RISK')])).toMatchObject({attempted:5,completed:4,failed:1,truePositive:1,falseNegative:1,falsePositive:1,trueNegative:0,falseNegativeRate:0.5,falsePositiveRate:1});
    expect(summarizeEvaluation([]).falseNegativeRate).toBeNull();
  });
  it('runs the complete rules set without model usage',async()=>{
    const rows=await runEvaluation('RULES_ONLY',defaultPrompt,CHALLENGE_SET.length);
    expect(rows).toHaveLength(CHALLENGE_SET.length);
    expect(rows.every(row=>row.status==='SUCCESS'&&row.inputTokens===null)).toBe(true);
    expect(summarizeEvaluation(rows).failed).toBe(0);
  });
  it('rejects oversized paid evaluations before calls',async()=>{
    await expect(runEvaluation('HYBRID_AI',defaultPrompt,5)).rejects.toThrow('INVALID_EVALUATION');
  });
});
