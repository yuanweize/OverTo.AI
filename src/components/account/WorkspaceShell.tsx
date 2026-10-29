'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ShieldCheck, SlidersHorizontal, Activity, LayoutDashboard, ScanText, History, Folder, KeyRound, Terminal, BarChart3, CreditCard, Settings, Menu, Cpu } from 'lucide-react';
import { Brand } from '@/components/branding/Brand';
import { Preferences } from '@/components/layout/Preferences';
import { LogoutButton } from './LogoutButton';
const navigation = [
  { key:'overview', href:'/dashboard', icon:LayoutDashboard },
  { key:'analyze', href:'/dashboard/analyze', icon:ScanText },
  { key:'history', href:'/dashboard/analyses', icon:History },
  { key:'projects', href:'/dashboard/projects', icon:Folder },
  { key:'keys', href:'/dashboard/api-keys', icon:KeyRound },
  { key:'playground', href:'/dashboard/playground', icon:Terminal },
  { key:'usage', href:'/dashboard/usage', icon:BarChart3 },
  { key:'billing', href:'/dashboard/billing', icon:CreditCard },
  { key:'settings', href:'/dashboard/settings', icon:Settings },
] as const;
const adminNavigation = [{ key:'site',href:'/admin',icon:SlidersHorizontal },{ key:'studio',href:'/admin/ai-studio',icon:Activity },{ key:'providers',href:'/admin/ai-studio/providers',icon:Settings },{ key:'models',href:'/admin/ai-studio/models',icon:Cpu },{ key:'prompts',href:'/admin/ai-studio/prompts',icon:ScanText },{ key:'evaluations',href:'/admin/ai-studio/evaluations',icon:BarChart3 },{ key:'datasets',href:'/admin/ai-studio/datasets',icon:Folder },{ key:'workspace',href:'/dashboard',icon:ShieldCheck }];
export function WorkspaceShell({name,email,children,admin=false}: {name:string;email:string;children:React.ReactNode;admin?:boolean}) {
  const t = useTranslations(admin ? 'AdminNav' : 'Dashboard');
  const pathname = usePathname();
  const items = admin ? adminNavigation : navigation;
  const current = items.find(item=>item.href===pathname);
  const links = <nav aria-label={t('navigation')} className="workspace-links">{items.map(({key,href,icon:Icon})=><Link key={key} href={href} aria-current={pathname===href?'page':undefined}><Icon aria-hidden size={18}/><span>{t(key)}</span></Link>)}</nav>;
  return <div className="workspace-shell"><aside className="workspace-sidebar"><Brand/><div className="workspace-desktop-nav"><p className="workspace-section-label">{t('personal')}</p>{links}</div><details key={pathname} className="workspace-mobile-nav"><summary><Menu aria-hidden size={18}/>{t('navigation')}</summary><div className="workspace-mobile-panel">{links}<LogoutButton/></div></details><div className="workspace-account"><p className="truncate font-semibold">{name}</p><p className="muted truncate text-xs">{email}</p><LogoutButton/></div></aside><div className="workspace-content"><header className="workspace-toolbar"><div><span className="muted text-xs">{t('personal')}</span><p className="font-semibold">{current ? t(current.key) : t('navigation')}</p></div><Preferences/></header><div className="workspace-environment"><span className="status-dot"/>{t('localNotice')}</div><main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</main></div></div>;
}
