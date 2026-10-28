import React from 'react';
import { AnalysisResult } from '@/types/analyzer';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  ShieldAlert,
  Lock,
  Clock,
  HelpCircle,
} from 'lucide-react';

interface AnalysisResultsViewProps {
  result: AnalysisResult;
}

export const AnalysisResultsView: React.FC<AnalysisResultsViewProps> = ({ result }) => {
  const isHighRisk = result.riskLevel === 'HIGH_RISK';
  const isVerification = result.riskLevel === 'VERIFICATION_RECOMMENDED';

  const getBadgeConfig = () => {
    if (isHighRisk) {
      return {
        bg: 'bg-rose-50 border-rose-200 text-rose-900',
        badge: 'bg-rose-600 text-white',
        icon: <AlertOctagon className="w-8 h-8 text-rose-600 shrink-0" />,
        levelCzech: 'VYSOKÉ RIZIKO PODVODU',
        borderColor: 'border-rose-400',
        scoreColor: 'text-rose-600',
      };
    }
    if (isVerification) {
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-900',
        badge: 'bg-amber-600 text-white',
        icon: <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />,
        levelCzech: 'DOPORUČENO PROVĚŘENÍ',
        borderColor: 'border-amber-400',
        scoreColor: 'text-amber-600',
      };
    }
    return {
      bg: 'bg-slate-50 border-slate-200 text-slate-800',
      badge: 'bg-slate-600 text-white',
      icon: <Info className="w-8 h-8 text-slate-600 shrink-0" />,
      levelCzech: 'NEZJIŠTĚNY ZJEVNÉ ZNAKY',
      borderColor: 'border-slate-300',
      scoreColor: 'text-slate-600',
    };
  };

  const badgeConfig = getBadgeConfig();

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden mt-6 animate-fade-in">
      {/* 1. Hlavní stavový banner */}
      <div className={`p-6 sm:p-8 border-b ${badgeConfig.bg} ${badgeConfig.borderColor}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200/60">
              {badgeConfig.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold tracking-wide uppercase ${badgeConfig.badge}`}>
                  {badgeConfig.levelCzech}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Režim: {result.metadata.engine === 'DETERMINISTIC_RULES' ? 'pravidla' : `pravidla a OpenAI${result.metadata.aiModel ? ` (${result.metadata.aiModel})` : ''}`}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {result.headlineCzech}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 bg-white/80 px-3.5 py-2 rounded-xl border border-slate-200/80 self-end sm:self-center shrink-0">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Vyhodnoceno za <strong>{result.metadata.processingTimeMs} ms</strong></span>
          </div>
        </div>

        <p className="mt-4 text-base text-slate-700 leading-relaxed font-medium bg-white/60 p-4 rounded-xl border border-slate-200/40">
          {result.summaryCzech}
        </p>
      </div>

      {result.metadata.aiStatus !== 'NOT_REQUESTED' && result.metadata.aiStatus !== 'SUCCESS' && (
        <p role="status" className="border-b border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-950">AI analýza není nyní dostupná nebo se nezdařila. Níže je pouze výsledek pravidel.</p>
      )}
      {result.semanticAnalysis && (
        <section aria-labelledby="semantic-title" className="border-b border-slate-200 p-6 sm:p-8">
          <h3 id="semantic-title" className="text-lg font-bold text-slate-900">Co AI ve zprávě rozpoznala</h3>
          <p className="mt-2 text-sm text-slate-700">Jde o možný výklad upraveného textu, nikoli ověření totožnosti nebo pravdivosti.</p>
          {result.semanticAnalysis.claimedIdentity && <p className="mt-3 text-sm text-slate-800"><strong>Uvedená identita:</strong> {result.semanticAnalysis.claimedIdentity}</p>}
          {result.semanticAnalysis.requestedActions.length > 0 && <div className="mt-4"><h4 className="font-semibold">Možné požadavky</h4><ul className="mt-2 space-y-2">{result.semanticAnalysis.requestedActions.map((item, i) => <li key={i} className="text-sm text-slate-700">{item.description}: <mark className="rounded bg-amber-100 px-1 text-slate-900">{item.evidenceText}</mark></li>)}</ul></div>}
          <p className="mt-4 text-sm text-slate-700">{result.semanticAnalysis.uncertainty.join(' ')}</p>
        </section>
      )}

      {/* 2. Akční verifikační kroky (Nejdůležitější sekce pro uživatele) */}
      <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                ✓
              </span>
              <span>Doporučený postup: Co konkrétně teď udělat</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Doporučené kroky k nezávislému ověření.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-md hidden sm:inline-block">
            {result.recommendedActions.length} konkrétní kroky
          </span>
        </div>

        <div className="space-y-3">
          {result.recommendedActions.map((action) => (
            <div
              key={action.step}
              className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                action.isWarning
                  ? 'bg-rose-50/80 border-rose-200 text-rose-950 shadow-xs'
                  : 'bg-white border-slate-200/80 text-slate-900 shadow-xs'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                  action.isWarning
                    ? 'bg-rose-600 text-white'
                    : 'bg-indigo-600 text-white'
                }`}
              >
                {action.step}
              </div>
              <div className="flex-1">
                <p className="text-base font-bold leading-snug">
                  {action.action}
                </p>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  {action.rationale}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Nalezené důkazy a rizikové signály */}
      <div className="p-6 sm:p-8 border-b border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-indigo-600" />
          <span>Nalezené možné signály ({result.evidences.length})</span>
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Pravidla a případně model navrhují možné signály; jejich výklad se může mýlit.
        </p>

        {result.evidences.length === 0 ? (
          <div className="p-5 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 text-sm">
            Nebyly detekovány žádné typické indikátory phishingu, nátlaku ani podvodných domén.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {result.evidences.map((evidence, idx) => (
              <div
                key={evidence.id + idx}
                className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {evidence.category.replace('_', ' ')}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        evidence.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-700'
                          : evidence.severity === 'HIGH'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {evidence.severity === 'CRITICAL'
                        ? 'KRITICKÉ RIZIKO'
                        : evidence.severity === 'HIGH'
                        ? 'VYSOKÉ RIZIKO'
                        : 'STŘEDNÍ'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {evidence.title}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {evidence.description}
                  </p>
                </div>

                {evidence.matchedSnippet && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wide">
                      Citace ze zprávy:
                    </span>
                    <code className="text-rose-700 bg-rose-50/70 px-2 py-1 rounded text-[11px] font-mono break-all block">
                      &quot;{evidence.matchedSnippet}&quot;
                    </code>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Ochrana soukromí a transparentnost (Zredigované PII) */}
      <div className="p-6 sm:p-8 bg-slate-50/70 border-b border-slate-100 text-xs text-slate-600">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span>Ochrana osobních údajů (Privacy First audit)</span>
          </div>
          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
            Maskování citlivých údajů je pouze orientační
          </span>
        </div>
        <p className="text-slate-500 mb-2">
          Níže je text zpracovaný serverem. Automatické maskování nemusí zachytit všechny osobní údaje:
        </p>
        <div className="p-3 bg-white border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700 break-words max-h-32 overflow-y-auto">
          {result.sanitizedText}
        </div>
      </div>

      {/* 5. Etické upozornění o nejistotě */}
      <div className="p-4 sm:p-6 bg-slate-100/60 text-xs text-slate-500 flex items-start gap-3">
        <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {result.uncertaintyNotice} Systém OvěřTo.AI byl vyvinut v rámci festivalu mesic.ai pro AI výzvu pro Česko 2026.
        </p>
      </div>
    </div>
  );
};
