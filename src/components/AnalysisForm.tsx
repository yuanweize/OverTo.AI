import React, { useState } from 'react';
import { Search, Clipboard, Trash2, Lock, ArrowRight, Loader2 } from 'lucide-react';

interface AnalysisFormProps {
  text: string;
  onChangeText: (text: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
}

export const AnalysisForm: React.FC<AnalysisFormProps> = ({
  text,
  onChangeText,
  onAnalyze,
  isLoading,
}) => {
  const [copiedTip, setCopiedTip] = useState(false);

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        onChangeText(clipText);
        setCopiedTip(true);
        setTimeout(() => setCopiedTip(false), 2000);
      }
    } catch {
      // Fallback pokud není povolen přístup k clipboardu
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (text.trim().length > 0 && !isLoading) {
        onAnalyze();
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-200/40 p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3 mb-3">
        <label htmlFor="message-input" className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
          <span>Vložte text podezřelé zprávy nebo odkaz</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePaste}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            title="Vložit obsah ze schránky"
          >
            <Clipboard className="w-3.5 h-3.5 text-slate-600" />
            <span>{copiedTip ? 'Vloženo!' : 'Vložit ze schránky'}</span>
          </button>
          {text.length > 0 && (
            <button
              type="button"
              onClick={() => onChangeText('')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
              title="Vymazat text"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Smazat</span>
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <textarea
          id="message-input"
          rows={5}
          maxLength={10000}
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Zkopírujte sem podezřelou SMS, e-mail, zprávu z WhatsAppu nebo webovou adresu (např. 'Ceska posta: Vas balicek nebyl dorucen...')."
          className="w-full text-base sm:text-lg p-4 sm:p-5 rounded-2xl border border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all outline-none resize-y text-slate-900 placeholder:text-slate-400 font-sans"
        />
        <div className="absolute right-3 bottom-3 text-xs text-slate-400 bg-white/90 px-2 py-0.5 rounded-md pointer-events-none">
          {text.length} / 10 000 znaků
        </div>
      </div>

      {/* Ochrana soukromí & spouštěcí tlačítko */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200/60 px-3.5 py-2.5 rounded-xl">
          <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong>Před odesláním uvidíte upravený text.</strong> Maskování nemusí rozpoznat všechny citlivé údaje.
          </span>
        </div>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={isLoading || text.trim().length === 0}
          className={`inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-base transition-all shadow-md shrink-0 ${
            isLoading || text.trim().length === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:shadow-indigo-300 active:scale-[0.98]'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Provádím analýzu rizik...</span>
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>Pokračovat ke kontrole textu</span>
              <ArrowRight className="w-4 h-4 opacity-70" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
