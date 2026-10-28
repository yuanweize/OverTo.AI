'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Header } from '@/components/Header';
import { ScenarioSelector } from '@/components/ScenarioSelector';
import { AnalysisForm } from '@/components/AnalysisForm';
import { AnalysisResultsView } from '@/components/AnalysisResultsView';
import { VerificationWorkflow } from '@/components/VerificationWorkflow';
import { EmergencyChecklist } from '@/components/EmergencyChecklist';
import { Footer } from '@/components/Footer';
import { sanitizeInput } from '@/lib/sanitizer';
import { DemoScenario, AnalysisResult } from '@/types/analyzer';
import { AlertCircle, ShieldCheck, Eye, Route } from 'lucide-react';

export function AnalysisWorkspace({ accountMode = false }: { accountMode?: boolean }) {
  const inputVersion = useRef(0);
  const [inputText, setInputText] = useState<string>('');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [creditsCharged, setCreditsCharged] = useState<number | null>(null);
  const Main = accountMode ? 'div' : 'main';
  const previewOpen = preview !== null;
  useEffect(() => { if (previewOpen) document.getElementById('preview-title')?.focus(); }, [previewOpen]);
  useEffect(() => { if (analysisResult) document.getElementById('result-title')?.focus(); }, [analysisResult]);

  const preparePreview = () => {
    if (!inputText.trim()) return;
    setPreview(sanitizeInput(inputText).sanitizedText);
    setReviewed(false);
    setAiConsent(false);
    setAnalysisResult(null);
    setErrorMessage(null);
    setCreditsCharged(null);
  };

  const handleSelectScenario = (scenario: DemoScenario) => {
    inputVersion.current++;
    setPreview(null);
    setSelectedScenarioId(scenario.id);
    setInputText(scenario.sampleText);
    setAnalysisResult(null);
    setErrorMessage(null);
    document.getElementById('message-input')?.focus();
  };

  const handleAnalyze = async () => {
    if (!preview?.trim() || !reviewed) return;
    const safePreview = sanitizeInput(preview).sanitizedText;
    if (safePreview !== preview) {
      setPreview(safePreview);
      setReviewed(false);
      setAiConsent(false);
      setErrorMessage('V upraveném textu byly nalezeny další údaje. Zkontrolujte novou podobu před odesláním.');
      return;
    }
    const version = inputVersion.current;
    setIsLoading(true);
    setErrorMessage(null);
    setAnalysisResult(null);

    try {
      const response = await fetch(accountMode ? '/api/local/analyses' : '/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accountMode ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
        },
        body: JSON.stringify({
          text: safePreview,
          enableLlm: aiConsent,
          aiConsent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Analýza selhala. Zkuste to prosím znovu.');
      }

      const data = await response.json();
      if (version === inputVersion.current) {
        setAnalysisResult(accountMode ? data.result : data);
        if (accountMode) setCreditsCharged(data.creditsCharged);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Došlo k neočekávané chybě.';
      if (version === inputVersion.current) setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {!accountMode && <Header />}

      <a href="#message-input" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:text-teal-900">Přejít k zadání zprávy</a>
      <Main className="flex-1">
        <section id="top" className="bg-[#eef5f3] pt-10 pb-7 sm:pt-14 sm:pb-10">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-800"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Pomocník pro podezřelé zprávy</p>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">Nejste si jistí zprávou? Zastavte se a ověřte ji.</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-700 sm:text-lg">Vložte zprávu a zjistěte, na co si dát pozor a jak bezpečně pokračovat.</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-700">
              <span className="inline-flex items-center gap-2"><Eye className="h-4 w-4 text-teal-700" aria-hidden="true" /> Text před odesláním zkontrolujete</span>
              <span className="inline-flex items-center gap-2"><Route className="h-4 w-4 text-teal-700" aria-hidden="true" /> Praktický postup ověření</span>
            </div>
          </div>
        </section>

        {/* INTERAKTIVNÍ PRACOVNÍ PLOCHA (Scénáře + Formulář + Výsledky) */}
        <section className="py-8 sm:py-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <AnalysisForm
              text={inputText}
              onChangeText={(newText) => {
                inputVersion.current++;
                setInputText(newText);
                setPreview(null);
                setReviewed(false);
                setAiConsent(false);
                setAnalysisResult(null);
                setSelectedScenarioId(null);
                setErrorMessage(null);
              }}
              onAnalyze={preparePreview}
              isLoading={isLoading}
            />
            <ScenarioSelector selectedId={selectedScenarioId} onSelectScenario={handleSelectScenario} />

            {preview !== null && (
              <section aria-labelledby="preview-title" className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm sm:p-7">
                <h2 id="preview-title" tabIndex={-1} className="text-xl font-bold text-slate-900">Zkontrolujte, co odešlete</h2>
                <p id="preview-help" className="mt-2 text-sm leading-relaxed text-slate-700">Prohlížeč se pokusil skrýt některé citlivé údaje a odstranit cestu a parametry odkazů. Může něco přehlédnout, například jména nebo adresy. Odstraňte je ručně. Text níže a názvy hostitelů odešleme našemu serveru.</p>
                <label htmlFor="preview-text" className="mt-4 block text-sm font-semibold text-slate-900">Text k odeslání (můžete jej upravit)</label>
                <textarea id="preview-text" aria-describedby="preview-help" rows={6} maxLength={10000} value={preview} onChange={e => { inputVersion.current++; setPreview(e.target.value); setReviewed(false); setAiConsent(false); setAnalysisResult(null); }} className="mt-2 w-full rounded-lg border border-slate-400 bg-white p-4 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700" />
                <label className="mt-3 flex min-h-11 items-start gap-3 text-sm text-slate-800"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} className="mt-1 h-4 w-4 accent-teal-700" /><span>Zkontroloval/a jsem text a odstranil/a údaje, které nechci odeslat.</span></label>
                <label className="mt-3 flex min-h-12 items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-950"><input type="checkbox" checked={aiConsent} onChange={e => setAiConsent(e.target.checked)} aria-describedby="ai-privacy" className="h-4 w-4 accent-teal-700" /><span>Chci použít AI a souhlasím s předáním upraveného textu službě OpenLux a jejímu poskytovateli modelu. Bez zaškrtnutí použijeme pouze pravidla.</span></label>
                <p id="ai-privacy" className="mt-3 text-sm leading-6 text-slate-700">V AI režimu mohou OpenLux a jeho poskytovatel modelu obdržet vše, co v textu zůstane, včetně hostitelů odkazů. Uchování a zpracování se řídí podmínkami OpenLux a jeho poskytovatelů; provozovatel hostingu může vést technické záznamy. Aplikace zprávy neukládá do databáze. AI nemusí být na tomto serveru dostupná; v takovém případě dostanete výsledek pravidel.</p>
                {accountMode && <p className="mt-3 text-sm font-semibold text-slate-700">Místní test: úspěšná analýza stojí 1 testovací kredit. Pokud požadovaná AI selže, zobrazíme pravidlový výsledek bez odečtu.</p>}
                <button type="button" onClick={handleAnalyze} disabled={!reviewed || !preview.trim() || isLoading} className="mt-5 min-h-12 w-full rounded-lg bg-teal-800 px-6 py-3 font-bold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:w-auto">{isLoading ? 'Probíhá analýza…' : aiConsent ? 'Odeslat a analyzovat s AI' : 'Odeslat a analyzovat pravidly'}</button>
                <p role="status" className="mt-2 text-sm text-slate-600">{isLoading ? 'Vyčkejte prosím na výsledek.' : ''}</p>
              </section>
            )}

            {/* Chybové hlášení */}
            {errorMessage && (
              <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Zobrazení výsledků analýzy */}
            {analysisResult && (
              <div key={analysisResult.metadata.analyzedAt}>{accountMode && <p role="status" className="mb-4 rounded-lg border border-teal-200 bg-white p-4 text-sm font-semibold">Odečteno testovacích kreditů: {creditsCharged}</p>}<AnalysisResultsView result={analysisResult} /><VerificationWorkflow categories={analysisResult.detectedCategories} /></div>
            )}
          </div>
        </section>

        <EmergencyChecklist />
      </Main>

      {!accountMode && <Footer />}
    </div>
  );
}
