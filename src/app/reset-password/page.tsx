import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { PasswordRecovery } from '@/components/account/PasswordRecovery';

export default async function ResetPasswordPage() {
  const t = await getTranslations('Auth');
  return (
    <div className="min-h-screen bg-[#f6f8f7] dark:bg-slate-950">
      <Header />
      <main id="main" className="mx-auto w-full max-w-xl px-5 py-16">
        <h1 className="text-3xl font-bold text-slate-950 dark:text-slate-100">{t('reset')}</h1>
        <Suspense fallback={<p className="text-slate-600 dark:text-slate-400">{t('loading')}</p>}>
          <PasswordRecovery reset />
        </Suspense>
      </main>
    </div>
  );
}
