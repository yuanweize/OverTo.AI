import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'OvěřTo.AI — Bezpečný asistent pro ověření podezřelých zpráv a podvodů',
  description: 'Český AI asistent pro analýzu podezřelých SMS, e-mailů a odkazů. Projekt pro soutěž AI výzva pro Česko 2026 (mesic.ai) na základě Českého barometru obav z AI 2026.',
  keywords: [
    'OvěřTo.AI',
    'AI podvody',
    'Český barometr obav z AI 2026',
    'ČAUI',
    'mesic.ai',
    'phishing ověření',
    'kybernetická bezpečnost',
    'falešný bankéř',
    'ochrana seniorů před podvody',
  ],
  authors: [{ name: 'HKTSE s.r.o. & Weize Yuan' }],
  metadataBase: new URL('https://overto.ai'),
  openGraph: {
    title: 'OvěřTo.AI — Bezpečný asistent pro ověření podezřelých zpráv',
    description: 'Nejste si jisti obdrženou SMS či e-mailem? Ověřte si fakta bezpečně, bez prozrazení osobních údajů a s konkrétním návodem na nezávislé prověření.',
    locale: 'cs_CZ',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs" className={`${inter.variable} h-full scroll-smooth`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
