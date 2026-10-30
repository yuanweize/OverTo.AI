import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import { Clipboard, Trash2, Lock, ArrowRight, Loader2 } from 'lucide-react';

interface AnalysisFormProps { text: string; onChangeText: (text: string) => void; onAnalyze: () => void; isLoading: boolean; }

export const AnalysisForm: React.FC<AnalysisFormProps> = ({ text, onChangeText, onAnalyze, isLoading }) => {
  const t = useTranslations('Analysis');
  const [pasteStatus, setPasteStatus] = useState('');
  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) { onChangeText(clipText); setPasteStatus(t('pasted')); }
      else setPasteStatus(t('emptyClipboard'));
    } catch { setPasteStatus(t('clipboardError')); }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && text.trim() && !isLoading) { e.preventDefault(); onAnalyze(); }
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_38px_rgba(15,45,55,0.07)]">
      <div className="p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div><label htmlFor="message-input" className="block text-lg font-bold text-slate-900">{t('input')}</label><p id="message-help" className="mt-1 text-sm leading-6 text-slate-600">{t('inputHelp')}</p></div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={handlePaste} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"><Clipboard className="h-4 w-4" aria-hidden="true" />{t('paste')}</button>
            {text.length > 0 && <button type="button" onClick={() => onChangeText('')} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"><Trash2 className="h-4 w-4" aria-hidden="true" />{t('clear')}</button>}
          </div>
        </div>
        <textarea id="message-input" rows={6} maxLength={10000} value={text} onChange={e => onChangeText(e.target.value)} onKeyDown={handleKeyDown} aria-describedby="message-help" placeholder={t('placeholder')} className="block w-full resize-y rounded-xl border border-slate-300 bg-slate-50/70 p-4 text-base leading-7 text-slate-900 placeholder:text-slate-500 focus:border-teal-700 focus:bg-white focus:outline-2 focus:outline-offset-2 focus:outline-teal-700" />
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-slate-600"><span role="status">{pasteStatus}</span><span>{text.length} / 10 000 {t('characters')}</span></div>
      </div>
      <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="flex max-w-sm items-start gap-2 text-sm leading-5 text-slate-600"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" /><span>{t('privacyNote')}</span></p>
        <button type="button" onClick={onAnalyze} disabled={isLoading || !text.trim()} className="analysis-submit inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-base font-bold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">{isLoading ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />{t('busy')}</> : <>{t('continue')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></>}</button>
      </div>
    </div>
  );
};
