import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { PasswordRecovery } from '@/components/account/PasswordRecovery';
export default function ForgotPasswordPage() { return <><Header/><main className="mx-auto w-full max-w-xl px-5 py-16"><h1 className="text-3xl font-bold">Obnovení hesla</h1><p className="mt-4 leading-7 text-slate-700">V místním testu se odkaz zachytí v testovací schránce, neposílá se na skutečnou adresu.</p><Suspense fallback={<p>Načítání…</p>}><PasswordRecovery/></Suspense></main></>; }
