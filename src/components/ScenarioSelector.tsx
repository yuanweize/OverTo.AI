import React from 'react';
import { DEMO_SCENARIOS } from '@/lib/demo-scenarios';
import { DemoScenario } from '@/types/analyzer';
import { Package, Building2, MessageCircle, TrendingUp, ShoppingBag, CheckCircle2, HelpCircle } from 'lucide-react';

interface ScenarioSelectorProps {
  onSelectScenario: (scenario: DemoScenario) => void;
  selectedId: string | null;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  onSelectScenario,
  selectedId,
}) => {
  const getIcon = (category: string) => {
    switch (category) {
      case 'PACKAGE_DELIVERY':
        return <Package className="w-3.5 h-3.5 text-amber-600" />;
      case 'PAYMENT_DEMAND':
        return <Building2 className="w-3.5 h-3.5 text-rose-600" />;
      case 'FAMILY_EMERGENCY':
        return <MessageCircle className="w-3.5 h-3.5 text-purple-600" />;
      case 'INVESTMENT_FRAUD':
        return <TrendingUp className="w-3.5 h-3.5 text-red-600" />;
      case 'BENIGN':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Rychlé vyzkoušení reálných českých případů (1 kliknutí)
          </h2>
          <p className="text-xs text-slate-600">
            Vyberte si ze simulací autentických zpráv, které v ČR způsobují největší škody.
          </p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 self-start sm:self-auto">
          8 vzorových scénářů
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DEMO_SCENARIOS.map((scenario) => {
          const isSelected = selectedId === scenario.id;
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onSelectScenario(scenario)}
              className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-1.5 ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-sm ring-1 ring-indigo-500'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/60 hover:bg-slate-100/70 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="p-1 rounded-md bg-white border border-slate-200/60 shadow-xs">
                  {getIcon(scenario.category)}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    scenario.expectedRiskLevel === 'HIGH_RISK'
                      ? 'bg-rose-100 text-rose-700'
                      : scenario.expectedRiskLevel === 'VERIFICATION_RECOMMENDED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {scenario.expectedRiskLevel === 'HIGH_RISK'
                    ? 'Podvod'
                    : scenario.expectedRiskLevel === 'VERIFICATION_RECOMMENDED'
                    ? 'Běžné'
                    : 'Nejasné'}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold leading-snug line-clamp-2">
                  {scenario.title}
                </p>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                  {scenario.sourceType} • {scenario.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
