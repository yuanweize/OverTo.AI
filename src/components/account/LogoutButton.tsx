'use client';
import { authClient } from '@/auth/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
export function LogoutButton() { const router = useRouter(); const t = useTranslations('Dashboard'); return <button onClick={async () => { await authClient.signOut(); router.push('/login'); router.refresh(); }} className="min-h-11 text-left text-sm font-semibold text-slate-600 hover:text-teal-800">{t('logout')}</button>; }
