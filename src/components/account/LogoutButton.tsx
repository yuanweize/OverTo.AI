'use client';
import { authClient } from '@/auth/client';
import { useRouter } from 'next/navigation';
export function LogoutButton() { const router = useRouter(); return <button onClick={async () => { await authClient.signOut(); router.push('/login'); router.refresh(); }} className="min-h-11 text-left text-sm font-semibold text-slate-600 hover:text-teal-800">Odhlásit se</button>; }
