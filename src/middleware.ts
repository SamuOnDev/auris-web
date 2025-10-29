import type { MiddlewareHandler } from 'astro';
import {
    SUPPORTED,
    DEFAULT_LANG,
    normalizeLang,
    fromAcceptLanguage,
    type Lang,
} from './i18n';

export const onRequest: MiddlewareHandler = async (
    { request, redirect, locals, url },
    next,
    ) => {
    const path = url.pathname; // e.g. "/", "/contact"
    const excludedPrefixes = ['/_astro', '/api', '/favicon', '/robots', '/sitemap'];

    const isExcluded = excludedPrefixes.some((prefix) => path.startsWith(prefix)) || path.includes('.');
    if (isExcluded) {
        return next();
    }
    const [, first] = path.split('/'); // posible lang

    // Si ya viene /{lang}/..., continúa
    if (SUPPORTED.includes(first as Lang)) {
        locals.lang = first as Lang;
        return next();
    }

    // 1) Cookie
    const cookie = request.headers.get('cookie') || '';
    const match = cookie.match(/(?:^|;\s*)lang=([A-Za-z-]+)/);
    const cookieLang = normalizeLang(match?.[1] || '');

    // 2) Accept-Language
    const headerLang = fromAcceptLanguage(request.headers.get('accept-language'));

    const resolved = match?.[1] ? cookieLang : headerLang || DEFAULT_LANG;
    return redirect(`/${resolved}${path}`, 307);
};
