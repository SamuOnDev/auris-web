import { DEFAULT_LANG, SUPPORTED, type Lang } from '../i18n';

export type AlternateLink = {
    hrefLang: string;
    href: string;
};

interface LocaleConfig {
    origin: string;
    pathPrefix: string;
    hrefLang: string;
}

export const LOCALE_CONFIG: Record<Lang, LocaleConfig> = {
    es: {
        origin: 'https://auris.cat',
        pathPrefix: '/es',
        hrefLang: 'es-ES',
    },
    en: {
        origin: 'https://auris.cat',
        pathPrefix: '/en',
        hrefLang: 'en-GB',
    },
    ca: {
        origin: 'https://auris.cat',
        pathPrefix: '/ca',
        hrefLang: 'ca-ES',
    },
    fr: {
        origin: 'https://auris.cat',
        pathPrefix: '/fr',
        hrefLang: 'fr-FR',
    },
    de: {
        origin: 'https://auris.cat',
        pathPrefix: '/de',
        hrefLang: 'de-DE',
    },
    it: {
        origin: 'https://auris.cat',
        pathPrefix: '/it',
        hrefLang: 'it-IT',
    },
};

const ensureLeadingSlash = (value: string) => (value.startsWith('/') ? value : `/${value}`);

export const normalizePath = (path: string): string => {
    if (!path) {
        return '/';
    }

    const withLeadingSlash = ensureLeadingSlash(path);
    if (withLeadingSlash === '/') {
        return '/';
    }

    return withLeadingSlash.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
};

const getLocaleConfig = (lang: Lang): LocaleConfig => {
    return LOCALE_CONFIG[lang] ?? LOCALE_CONFIG[DEFAULT_LANG];
};

const buildLocalizedPath = (config: LocaleConfig, path: string): string => {
    const { pathPrefix } = config;
    const normalized = normalizePath(path);
    if (normalized === '/') {
        const base = pathPrefix.length > 0 ? `${pathPrefix}/` : '/';
        return base.replace(/\/+/g, '/');
    }

    const prefix = pathPrefix.length > 0 ? pathPrefix : '';
    const combined = `${prefix}${normalized}`;
    return ensureLeadingSlash(combined.replace(/\/+/g, '/'));
};

export const getCanonicalUrl = (lang: Lang, path: string): string => {
    const config = getLocaleConfig(lang);
    const localizedPath = buildLocalizedPath(config, path);
    return new URL(localizedPath, config.origin).toString();
};

export const getAlternateLinks = (path: string): AlternateLink[] => {
    return SUPPORTED.map((code) => {
        const config = getLocaleConfig(code);
        return {
            hrefLang: config.hrefLang,
            href: getCanonicalUrl(code, path),
        };
    });
};

export const stripLangFromPath = (path: string): string => {
    const raw = path && path.length > 0 ? ensureLeadingSlash(path) : '/';
    if (raw === '/') {
        return '/';
    }

    const segments = raw.split('/');
    const maybeLang = segments[1];
    if (maybeLang && (SUPPORTED as readonly string[]).includes(maybeLang as Lang)) {
        const remainder = segments.slice(2).join('/');
        const normalized = remainder.length > 0 ? `/${remainder}` : '/';
        return normalizePath(normalized);
    }

    return normalizePath(raw);
};