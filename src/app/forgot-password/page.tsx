import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { PasswordRecovery } from '@/components/account/PasswordRecovery';
import { accountDeployment } from '@/auth/deployment';

export default async function ForgotPasswordPage() {
  const t = await getTranslations('Auth');
  let deployment = null;
  try {
    deployment = accountDeployment(process.env);
  } catch {
    deployment = null;
  }
  const isSelfHost = deployment?.mode === 'selfhost';

  return (
    <>
      <Header />
      <main id="main" className="mx-auto w-full max-w-xl px-5 py-16">
        <h1 className="text-3xl font-bold">{t('recovery')}</h1>
        <p className="mt-4 leading-7 text-slate-700">
          {isSelfHost ? t('selfhostRecoveryNote') : t('recoveryNote')}
        </p>
        <Suspense fallback={<p>{t('loading')}</p>}>
          <PasswordRecovery />
        </Suspense>
      </main>
    </>
  );
}
