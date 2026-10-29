'use client';
import { createContext, useContext } from 'react';
import { defaultSiteConfig, type SiteConfig } from '@/server/config/site-schema';
const Context = createContext<SiteConfig>(defaultSiteConfig);
const ThemeContext = createContext('system');
export const useSite = () => useContext(Context);
export const useInitialTheme = () => useContext(ThemeContext);
export function SiteProvider({ config, theme = 'system', children }: { config: SiteConfig; theme?: string; children: React.ReactNode }) { return <Context.Provider value={config}><ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider></Context.Provider>; }
