import es from './locales/es.json';
import en from './locales/en.json';
import ca from './locales/ca.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import type { TranslationKey } from './translation-keys.ts';
export type { TranslationKey } from './translation-keys.ts';
export { TRANSLATION_KEYS } from './translation-keys.ts';

export const SUPPORTED = ['es', 'en', 'ca', 'fr', 'de', 'it'] as const;
export type Lang = typeof SUPPORTED[number];
export const DEFAULT_LANG: Lang = 'es';

type PrivacySection = {
    title: string;
    body: string[];
    list?: string[];
};

type TermsSection = {
    title: string;
    body: string[];
};

type CookieControlsContent = {
    heading: string;
    description: string;
    statusUnknown: string;
    statusAccepted: string;
    statusRejected: string;
    accept: string;
    reject: string;
    note: string;
};

type PrivacyContent = {
    metaTitle: string;
    heading: string;
    intro: string;
    sections: PrivacySection[];
    lastUpdatedLabel: string;
    cookieControls: CookieControlsContent;
};

type TermsContent = {
    metaTitle: string;
    heading: string;
    intro: string;
    sections: TermsSection[];
    lastUpdatedLabel: string;
};

type StringTranslations = { [K in TranslationKey]: string };

export type Dictionary = StringTranslations & {
    privacy: PrivacyContent;
    terms: TermsContent;
};

const DICTS = { es, en, ca, fr, de, it } as Record<Lang, Dictionary>;

export const LANGUAGE_LABELS: Record<Lang, string> = {
    es: '🇪🇸',
    en: '🇬🇧',
    ca: 'Català',
    fr: '🇫🇷',
    de: '🇩🇪',
    it: '🇮🇹',
};

export const LANGUAGE_OPTIONS: ReadonlyArray<{ code: Lang; label: string }> = SUPPORTED.map((code) => ({
    code,
    label: LANGUAGE_LABELS[code],
}));

export function getDict(lang: Lang): Dictionary {
    return DICTS[lang] ?? DICTS[DEFAULT_LANG];
}

/** Helper: si falta una clave, cae a ES para evitar roturas en build */
export function t(lang: Lang, key: TranslationKey): string {
    const dict = getDict(lang);
    return dict[key] ?? DICTS[DEFAULT_LANG][key] ?? '';
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
    if (!header) return DEFAULT_LANG;
    const prefs = header
        .split(',')
        .map((p) => {
        const [tag, qstr] = p.trim().split(';q=');
        return {
            lang: normalizeLang(tag),
            q: qstr ? parseFloat(qstr) : 1,
        };
        })
        .sort((a, b) => b.q - a.q);
    for (const p of prefs) if (SUPPORTED.includes(p.lang)) return p.lang;
    return DEFAULT_LANG;
}
