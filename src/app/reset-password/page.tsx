import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { PasswordRecovery } from '@/components/account/PasswordRecovery';
export default function ResetPasswordPage() { return <><Header/><main className="mx-auto w-full max-w-xl px-5 py-16"><h1 className="text-3xl font-bold">Nastavit nové heslo</h1><Suspense fallback={<p>Načítání…</p>}><PasswordRecovery reset/></Suspense></main></>; }
