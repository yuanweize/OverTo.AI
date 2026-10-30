export type Locale = 'cs' | 'en';
export function resolveLocale(preference: string | undefined, acceptLanguage: string | null, fallback: Locale = 'cs'): Locale {
  if (preference === 'cs' || preference === 'en') return preference;
  const languages = (acceptLanguage || '').slice(0, 2048).split(',').map((part, index) => {
    const [tag, ...parameters] = part.trim().split(';');
    const q = parameters.find(p => p.trim().startsWith('q='));
    return { language: tag.toLowerCase().split('-')[0], weight: q ? Number(q.trim().slice(2)) : 1, index };
  }).filter(item => Number.isFinite(item.weight) && item.weight > 0 && item.weight <= 1).sort((a, b) => b.weight - a.weight || a.index - b.index);
  return languages.find(item => item.language === 'cs' || item.language === 'en')?.language as Locale || fallback;
}
