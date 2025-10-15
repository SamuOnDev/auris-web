export const SUPPORTED = ['es', 'en'] as const;
export type Lang = typeof SUPPORTED[number];
export const DEFAULT_LANG: Lang = 'es';

export function normalizeLang(input? : string | null): Lang {
    const base = (input || '')
        .toLowerCase()
        .split('-')[0];
    return (SUPPORTED as readonly string[]).includes(base)
        ? (base as Lang)
        : DEFAULT_LANG;
}

export function fromAcceptLanguage(header : string | null): Lang {
    if (!header) 
        return DEFAULT_LANG;
    const prefs = header
        .split(',')
        .map(p => {
            const [tag, qstr] = p
                .trim()
                .split(';q=');
            return {
                lang: normalizeLang(tag),
                q: qstr
                    ? parseFloat(qstr)
                    : 1
            };
        })
        .sort((a, b) => b.q - a.q);
    for (const p of prefs) 
        if (SUPPORTED.includes(p.lang)) 
            return p.lang;
return DEFAULT_LANG;
}

export const t = (lang : Lang) => ({
    nav: {
        home: lang === 'es'
            ? 'Inicio'
            : 'Home',
        about: lang === 'es'
            ? 'Quiénes somos'
            : 'About',
        contact: lang === 'es'
            ? 'Contacto'
            : 'Contact'
    },
    hero: {
        badge: lang === 'es'
            ? 'Consultoría psicológica de referencia'
            : 'Leading psychological consultancy',
        title1: lang === 'es'
            ? 'Te ayudamos a recuperar tu '
            : 'We help you get your ',
        title2: lang === 'es'
            ? 'Salud Mental'
            : 'Mental Health',
        cta1: lang === 'es'
            ? 'Primera sesión gratis'
            : 'Free first session',
        cta2: lang === 'es'
            ? 'Regala terapia'
            : 'Gift therapy'
    },
    footer: lang === 'es'
        ? 'Todos los derechos reservados.'
        : 'All rights reserved.'
});
