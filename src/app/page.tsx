'use client';

import React, { useRef, useState } from 'react';
import { Header } from '@/components/Header';
import { ScenarioSelector } from '@/components/ScenarioSelector';
import { AnalysisForm } from '@/components/AnalysisForm';
import { AnalysisResultsView } from '@/components/AnalysisResultsView';
import { VerificationWorkflow } from '@/components/VerificationWorkflow';
import { BarometerInsights } from '@/components/BarometerInsights';
import { HowItWorks } from '@/components/HowItWorks';
import { EmergencyChecklist } from '@/components/EmergencyChecklist';
import { Footer } from '@/components/Footer';
import { sanitizeInput } from '@/lib/sanitizer';
import { DemoScenario, AnalysisResult } from '@/types/analyzer';
import { Shield, AlertCircle, CheckCircle } from 'lucide-react';

export default function Home() {
  const inputVersion = useRef(0);
  const [inputText, setInputText] = useState<string>('');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);

  const preparePreview = () => {
    if (!inputText.trim()) return;
    setPreview(sanitizeInput(inputText).sanitizedText);
    setReviewed(false);
    setAiConsent(false);
    setAnalysisResult(null);
    setErrorMessage(null);
  };

  const handleSelectScenario = (scenario: DemoScenario) => {
    inputVersion.current++;
    setPreview(null);
    setSelectedScenarioId(scenario.id);
    setInputText(scenario.sampleText);
    setAnalysisResult(null);
    setErrorMessage(null);
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
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

      const data: AnalysisResult = await response.json();
      if (version === inputVersion.current) setAnalysisResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Došlo k neočekávané chybě.';
      if (version === inputVersion.current) setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="pt-10 pb-8 sm:pt-14 sm:pb-12 bg-gradient-to-b from-white via-indigo-50/20 to-slate-50 border-b border-slate-200/60">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 mb-5 shadow-xs">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Odpověď na obavu č. 1 z Českého barometru obav z AI 2026</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Ověřte si podezřelou zprávu <br className="hidden sm:inline" />
              <span className="text-indigo-600">dříve, než kliknete</span> nebo pošlete peníze
            </h1>

            <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              <strong>77,5 % dotázaných</strong> se obává podvodů usnadněných umělou inteligencí. OvěřTo.AI vám pomůže odhalit nátlak, falešné bankéře a podvržené domény — s konkrétním návodem, jak zprávu bezpečně nezávisle prověřit.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Bez registrace
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Pokus o místní maskování údajů
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Pokyny k nezávislému ověření
              </span>
            </div>
          </div>
        </section>

        {/* INTERAKTIVNÍ PRACOVNÍ PLOCHA (Scénáře + Formulář + Výsledky) */}
        <section className="py-8 sm:py-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Výběr z reálných českých scénářů */}
            <ScenarioSelector
              selectedId={selectedScenarioId}
              onSelectScenario={handleSelectScenario}
            />

            <p className="text-sm text-slate-700">Před odesláním zkontrolujete upravený text. Bez registrace; analýza neověřuje totožnost odesílatele ani bezpečnost odkazu.</p>
            {/* Vstupní pole pro analýzu */}
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

            {preview !== null && (
              <section aria-labelledby="preview-title" className="rounded-2xl border border-slate-300 bg-white p-5 sm:p-7">
                <h2 id="preview-title" className="text-xl font-bold text-slate-900">Zkontrolujte text před odesláním</h2>
                <p id="preview-help" className="mt-2 text-sm leading-relaxed text-slate-700">Prohlížeč se pokusil skrýt některé citlivé údaje a odstranit cestu a parametry odkazů. Může něco přehlédnout, například jména nebo adresy. Odstraňte je ručně. Text níže a názvy hostitelů odešleme našemu serveru.</p>
                <label htmlFor="preview-text" className="mt-4 block text-sm font-semibold text-slate-900">Text k odeslání (můžete jej upravit)</label>
                <textarea id="preview-text" aria-describedby="preview-help" rows={6} maxLength={10000} value={preview} onChange={e => { inputVersion.current++; setPreview(e.target.value); setReviewed(false); setAiConsent(false); setAnalysisResult(null); }} className="mt-2 w-full rounded-lg border border-slate-400 bg-white p-4 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700" />
                <label className="mt-3 flex min-h-11 items-start gap-3 text-sm text-slate-800"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} className="mt-1 h-4 w-4 accent-indigo-700" /><span>Zkontroloval/a jsem text a odstranil/a údaje, které nechci odeslat.</span></label>
                <label className="mt-2 flex min-h-11 items-start gap-3 text-sm text-slate-800"><input type="checkbox" checked={aiConsent} onChange={e => setAiConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-indigo-700" /><span>Chci použít AI a souhlasím s předáním upraveného textu poskytovateli OpenAI. Bez zaškrtnutí použijeme pouze pravidla.</span></label>
                <p className="mt-2 text-sm text-slate-700">V AI režimu může OpenAI obdržet vše, co v textu zůstane, včetně hostitelů odkazů. Uchování a zpracování u OpenAI se řídí podmínkami poskytovatele; provozovatel hostingu může vést technické záznamy. Aplikace zprávy neukládá do databáze. AI nemusí být na tomto serveru dostupná; v takovém případě dostanete výsledek pravidel.</p>
                <button type="button" onClick={handleAnalyze} disabled={!reviewed || !preview.trim() || isLoading} className="mt-5 min-h-12 rounded-lg bg-indigo-700 px-6 py-3 font-bold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">{isLoading ? 'Probíhá analýza…' : aiConsent ? 'Odeslat a analyzovat s AI' : 'Odeslat a analyzovat pravidly'}</button>
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
              <div key={analysisResult.metadata.analyzedAt}><AnalysisResultsView result={analysisResult} /><VerificationWorkflow categories={analysisResult.detectedCategories} /></div>
            )}
          </div>
        </section>

        {/* ČESKÝ BAROMETR OBAV Z AI 2026 DATA */}
        <BarometerInsights />

        {/* JAK TO FUNGUJE & ARCHITEKTURA */}
        <HowItWorks />

        {/* SOS PRVNÍ POMOC */}
        <EmergencyChecklist />
      </main>

      <Footer />
    </div>
  );
}
