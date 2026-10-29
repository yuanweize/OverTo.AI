import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { PasswordRecovery } from '@/components/account/PasswordRecovery';
export default async function ResetPasswordPage() { const t = await getTranslations('Auth'); return <><Header/><main id="main" className="mx-auto w-full max-w-xl px-5 py-16"><h1 className="text-3xl font-bold">{t('reset')}</h1><Suspense fallback={<p>{t('loading')}</p>}><PasswordRecovery reset/></Suspense></main></>; }
