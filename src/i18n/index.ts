import es from './locales/es.json';
import en from './locales/en.json';
export const SUPPORTED = ['es', 'en'] as const;
export type Lang = typeof SUPPORTED[number];
export const DEFAULT_LANG: Lang = 'es';

const DICTS = { es, en } as const;

export function getDict(lang: Lang) {
    return (DICTS[lang] ?? DICTS[DEFAULT_LANG]) as typeof es;
}

/** Helper: si falta una clave, cae a ES para evitar roturas en build */
export function t(lang: Lang, key: keyof typeof es): string {
    const d = getDict(lang) as Record<string, string>;
    return d[key] ?? (es as Record<string,string>)[key] ?? '';
}
