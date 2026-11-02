import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { auth } from '@/auth/server';
import { Header } from '@/components/Header';
import { AuthForm } from './AuthForm';
import { accountDeployment } from '@/auth/deployment';

export async function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  if (auth) {
    let session = null;
    try {
      session = await auth.api.getSession({ headers: await headers() });
    } catch {
      session = null;
    }
    if (session?.user?.emailVerified) {
      redirect('/dashboard');
    }
  }

  const t = await getTranslations('Auth');
  let deployment = null;
  try {
    deployment = accountDeployment(process.env);
  } catch {
    deployment = null;
  }
  const isLocal = deployment?.mode === 'local';

  return (
    <div className="min-h-screen bg-[#f6f8f7] dark:bg-slate-950">
      <Header />
      <main id="main" className="mx-auto grid max-w-5xl gap-8 px-5 py-12 md:grid-cols-[1fr_1fr] md:gap-16 md:py-20">
        <div>
          <p className="text-sm font-semibold text-teal-800 dark:text-teal-400">{t('account')}</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
            {mode === 'signup' ? t('signupTitle') : t('loginTitle')}
          </h1>
          <p className="mt-5 max-w-md leading-7 text-slate-700 dark:text-slate-300">{t('intro')}</p>
          {isLocal && (
            <p className="mt-7 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {t('localNotice')}
            </p>
          )}
          <div className="mt-5">
            <Link href="/analyze" className="inline-flex min-h-11 items-center font-semibold text-teal-800 dark:text-teal-400 underline">
              {t('guest')}
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{mode === 'signup' ? t('signup') : t('login')}</h2>
          <AuthForm mode={mode} />
        </div>
      </main>
    </div>
  );
}
