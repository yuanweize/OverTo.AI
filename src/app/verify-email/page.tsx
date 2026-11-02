import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { accountDeployment } from '@/auth/deployment';

export default async function VerifyEmailPage() {
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
      <main id="main" className="mx-auto w-full max-w-2xl px-5 py-16">
        <p className="text-sm font-semibold text-teal-800">
          {isSelfHost ? t('selfhostAccount') : t('testAccount')}
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          {isSelfHost ? t('selfhostCheckInbox') : t('checkInbox')}
        </h1>
        <p className="mt-4 leading-7 text-slate-700">
          {isSelfHost ? t('selfhostVerifyNote') : t('verifyNote')}
        </p>
        {!isSelfHost && (
          <a
            href="http://127.0.0.1:8025"
            className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-teal-800 px-5 font-semibold text-white"
          >
            {t('openInbox')}
          </a>
        )}
        {!isSelfHost && <p className="mt-5 text-sm text-slate-600">{t('inboxWarning')}</p>}
        <div className="mt-6">
          <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-teal-800 underline">
            {t('backLogin')}
          </Link>
        </div>
      </main>
    </>
  );
}
