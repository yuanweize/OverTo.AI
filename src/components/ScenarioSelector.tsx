import { useTranslations } from 'next-intl';
import React from 'react';
import { DEMO_SCENARIOS } from '@/lib/demo-scenarios';
import { DemoScenario } from '@/types/analyzer';
import { ChevronDown, FlaskConical } from 'lucide-react';

interface ScenarioSelectorProps { onSelectScenario: (scenario: DemoScenario) => void; selectedId: string | null; }

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({ onSelectScenario, selectedId }) => {
 const t = useTranslations('Scenarios');
 return (
  <details className="group rounded-xl border border-slate-200 bg-white">
    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-3 text-sm font-semibold text-slate-800 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
      <span className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-teal-700" aria-hidden="true" />{t('title')}</span><ChevronDown className="h-4 w-4 text-slate-500 group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className="border-t border-slate-100 p-4 sm:p-5"><p className="mb-3 text-sm text-slate-600">{t('help')}</p>
      <div className="grid gap-2 sm:grid-cols-2">{DEMO_SCENARIOS.map(scenario => <button key={scenario.id} type="button" onClick={() => onSelectScenario(scenario)} aria-pressed={selectedId === scenario.id} className={`min-h-14 rounded-lg border px-4 py-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${selectedId === scenario.id ? 'border-teal-700 bg-teal-50 text-teal-950' : 'border-slate-200 bg-white text-slate-800 hover:border-teal-500 hover:bg-teal-50/50'}`}><span className="block">{t(`${scenario.id}.title`)}</span><span className="mt-1 block text-xs font-normal text-slate-600">{scenario.sourceType} · {t(`${scenario.id}.subtitle`)}</span></button>)}</div>
    </div>
  </details>
);
};
