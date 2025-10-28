import es from './locales/es.json';
import en from './locales/en.json';
import ca from './locales/ca.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';

export const SUPPORTED = ['es', 'en', 'ca', 'fr', 'de', 'it'] as const;
export type Lang = typeof SUPPORTED[number];
export type TranslationKey = keyof typeof es;
export const DEFAULT_LANG: Lang = 'es';

const DICTS = { es, en, ca, fr, de, it } as const;

export const LANGUAGE_LABELS: Record<Lang, string> = {
    es: '🇪🇸',
    en: '🇬🇧',
    ca: '🇦🇩',
    fr: '🇫🇷',
    de: '🇩🇪',
    it: '🇮🇹'
};

export const LANGUAGE_OPTIONS: ReadonlyArray<{ code: Lang; label: string }> = SUPPORTED.map((code) => ({
    code,
    label: LANGUAGE_LABELS[code]
}));

export function getDict(lang: Lang) {
    return (DICTS[lang] ?? DICTS[DEFAULT_LANG]) as typeof es;
}

/** Helper: si falta una clave, cae a ES para evitar roturas en build */
export function t(lang: Lang, key: TranslationKey): string {
    const d = getDict(lang) as Record<string, string>;
    return d[key] ?? (es as Record<string, string>)[key] ?? '';
}

export function normalizeLang(input?: string | null): Lang {
    const base = (input || '')
        .toLowerCase()
        .split('-')[0];
    return (SUPPORTED as readonly string[]).includes(base)
        ? (base as Lang)
        : DEFAULT_LANG;
}

export function fromAcceptLanguage(header: string | null): Lang {
    if (!header)
        return DEFAULT_LANG;
    const prefs = header
        .split(',')
        .map((p) => {
            const [tag, qstr] = p.trim().split(';q=');
            return {
                lang: normalizeLang(tag),
                q: qstr ? parseFloat(qstr) : 1
            };
        })
        .sort((a, b) => b.q - a.q);
    for (const p of prefs)
        if (SUPPORTED.includes(p.lang))
            return p.lang;
    return DEFAULT_LANG;
}