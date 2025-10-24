import type {MiddlewareHandler}
from 'astro';
import {SUPPORTED, DEFAULT_LANG, normalizeLang, fromAcceptLanguage} from './i18n/config';

export const onRequest: MiddlewareHandler = async ({
    request,
    redirect,
    locals,
    url
}, next) => {
    const path = url.pathname; // e.g. "/", "/contact"
    const excludedPrefixes = ['/_astro', '/api', '/favicon', '/robots', '/sitemap'];

    const isExcluded = excludedPrefixes.some(prefix => path.startsWith(prefix)) || path.includes('.');
    if (isExcluded) {
        return next();
    }
    const [, first] = path.split('/'); // posible lang

    // Si ya viene /{lang}/..., continúa
    if (SUPPORTED.includes(first as any)) {
        locals.lang = first as any;
        return next();
    }

    // 1) Cookie
    const cookie = request
        .headers
        .get('cookie') || '';
    const m = cookie.match(/(?:^|;\s*)lang=([A-Za-z-]+)/);
    const cookieLang = normalizeLang(
        m
            ?.[1] || ''
    );

    // 2) Accept-Language
    const headerLang = fromAcceptLanguage(request.headers.get('accept-language'));

    const resolved = m
        ?.[1]
            ? cookieLang
            : headerLang || DEFAULT_LANG;
    return redirect(`/${resolved}${path}`, 307);
};
