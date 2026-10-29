import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { AuthForm } from './AuthForm';
export async function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const t = await getTranslations('Auth');
  return <div className="min-h-screen bg-[#f6f8f7]"><Header/><main id="main" className="mx-auto grid max-w-5xl gap-8 px-5 py-12 md:grid-cols-[1fr_1fr] md:gap-16 md:py-20"><div><p className="text-sm font-semibold text-teal-800">{t('account')}</p><h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{mode === 'signup' ? t('signupTitle') : t('loginTitle')}</h1><p className="mt-5 max-w-md leading-7 text-slate-700">{t('intro')}</p><p className="mt-7 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{t('localNotice')}</p><Link href="/analyze" className="mt-5 inline-flex min-h-11 items-center font-semibold text-teal-800 underline">{t('guest')}</Link></div><div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-bold">{mode === 'signup' ? t('signup') : t('login')}</h2><AuthForm mode={mode}/></div></main></div>;
}
