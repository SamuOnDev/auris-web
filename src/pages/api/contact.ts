import type { APIRoute } from 'astro';
import { getDict } from '../../i18n';
import type { Lang } from '../../i18n';

const SUPPORTED_LANGS = ['es', 'en', 'ca', 'fr', 'de', 'it'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];
const DEFAULT_LANG: SupportedLang = 'es';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORBIDDEN_CONTENT_PATTERNS = [
    /(https?:\/\/|ftp:\/\/|www\.)/i,
    /(\.{1,2}[\\/])/,
    /(^|[\s])[A-Za-z]:\\/i,
    /(^|[\s@])[A-Za-z0-9._-]{2,}[\\/][A-Za-z0-9._-]{2,}/,
] as const;
const containsForbiddenContent = (value: string) =>
    FORBIDDEN_CONTENT_PATTERNS.some((pattern) => pattern.test(value));
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

const normalizeLang = (value?: string): SupportedLang => {
    if (!value) {
        return DEFAULT_LANG;
    }

    const base = value.toLowerCase().split('-')[0];
    return (SUPPORTED_LANGS as readonly string[]).includes(base)
        ? (base as SupportedLang)
        : DEFAULT_LANG;
};

const toStringField = (value: unknown): string => (typeof value === 'string' ? value : '');
const toOptionalString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};

const parseBody = async (request: Request) => {
    const data = await request.json().catch(() => null);

    if (!data || typeof data !== 'object') {
        return { name: '', email: '', message: '' };
    }

    const body = data as Record<string, unknown>;

    return {
        name: toStringField(body.name),
        email: toStringField(body.email),
        message: toStringField(body.message),
        website: toOptionalString(body.website),
        lang: toOptionalString(body.lang),
        token: toOptionalString(body.token),
    };
};

const parseAllowedOrigins = () => {
    const raw = import.meta.env.CONTACT_ALLOWED_ORIGINS;

    if (typeof raw !== 'string') {
        return [] as string[];
    }

    return raw
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
};

const ALLOWED_ORIGINS = parseAllowedOrigins();

const getDisabledMessage = (lang: SupportedLang) => {
    const dictionaryLang = (SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG) as Lang;
    const dict = getDict(dictionaryLang);
    if (typeof dict.contact_disabled_message === 'string') {
        return dict.contact_disabled_message;
    }

    const fallbackDict = getDict(DEFAULT_LANG as Lang);
    return fallbackDict.contact_disabled_message;
};

const getServiceUnavailableMessage = (lang: SupportedLang) => {
    const dictionaryLang = (SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG) as Lang;
    const dict = getDict(dictionaryLang);
    if (typeof dict.contact_service_unavailable === 'string') {
        return dict.contact_service_unavailable;
    }

    const fallbackDict = getDict(DEFAULT_LANG as Lang);
    return fallbackDict.contact_service_unavailable;
};


const resolveAllowedOrigin = (request: Request) => {
    const origin = request.headers.get('origin');

    if (!origin) {
        return undefined;
    }

    const requestOrigin = new URL(request.url).origin;

    if (origin === requestOrigin) {
        return origin;
    }

    if (
        ALLOWED_ORIGINS.length > 0 &&
        (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin))
    ) {
        return origin;
    }

    return undefined;
};

const json = (request: Request, data: unknown, status = 200, initHeaders?: HeadersInit) => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    const allowedOrigin = resolveAllowedOrigin(request);

    if (allowedOrigin) {
        headers['Access-Control-Allow-Origin'] = allowedOrigin;
        headers.Vary = 'Origin';
    }

    if (initHeaders) {
        const entries =
            initHeaders instanceof Headers
                ? Array.from(initHeaders.entries())
                : Array.isArray(initHeaders)
                    ? initHeaders
                    : Object.entries(initHeaders as Record<string, string>);

        for (const [key, value] of entries) {
            headers[key] = value;
        }
    }

    return new Response(JSON.stringify(data), { status, headers });
};

type RateLimitEntry = { count: number; expiresAt: number };

const getRateLimitStore = () => {
    const globalRef = globalThis as typeof globalThis & {
        __AURIS_RATE_LIMIT__?: Map<string, RateLimitEntry>;
    };

    if (!globalRef.__AURIS_RATE_LIMIT__) {
        globalRef.__AURIS_RATE_LIMIT__ = new Map<string, RateLimitEntry>();
    }

    return globalRef.__AURIS_RATE_LIMIT__;
};

const getClientIp = (request: Request) => {
    const headerCandidates = [
        'x-client-ip',
        'cf-connecting-ip',
        'fastly-client-ip',
        'true-client-ip',
        'x-real-ip',
        'x-forwarded-for',
    ];

    for (const header of headerCandidates) {
        const value = request.headers.get(header);

        if (value) {
            return value.split(',')[0]?.trim() || undefined;
        }
    }

    return undefined;
};

type RecaptchaVerificationResult =
    | { ok: true }
    | { ok: false; reason: string };

const verifyRecaptcha = async (
    token: string,
    secret: string,
    remoteIp: string | undefined,
    minScoreRaw: string | undefined,
): Promise<RecaptchaVerificationResult> => {
    const params = new URLSearchParams();
    params.set('secret', secret);
    params.set('response', token);

    if (remoteIp) {
        params.set('remoteip', remoteIp);
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
    });

    if (!response.ok) {
        return {
            ok: false,
            reason: `reCAPTCHA verification failed with status ${response.status}`,
        };
    }

    const data = (await response.json()) as {
        success: boolean;
        score?: number;
        action?: string;
        'error-codes'?: string[];
    };

    if (!data.success) {
        const errorCodes = data['error-codes']?.join(', ') ?? 'unknown-error';
        return { ok: false, reason: `reCAPTCHA not validated (${errorCodes})` };
    }

    if (typeof data.score === 'number') {
        const parsedScore = Number(minScoreRaw);
        const minScore = Number.isFinite(parsedScore) ? parsedScore : 0.5;

        if (data.score < minScore) {
            return { ok: false, reason: `reCAPTCHA score too low (${data.score})` };
        }
    }

    if (data.action && data.action !== 'contact_form') {
        return { ok: false, reason: `Unexpected reCAPTCHA action (${data.action})` };
    }

    return { ok: true };
};

const postJson = async (url: string, payload: unknown, headers: HeadersInit) => {
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = new Error(`Request to ${url} failed with status ${response.status}`);
        (error as Error & { status?: number }).status = response.status;
        throw error;
    }
};

const buildEmailHtml = (name: string, email: string, message: string) => {
    const escapeHtml = (value: string) =>
        value.replace(/[&<>"']/g, (match) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            }[match]!),
        );

    const escapedMessage = escapeHtml(message).replace(/\n/g, '<br>');

    return `
            <p><b>Nombre:</b> ${escapeHtml(name)}</p>
            <p><b>Email:</b> ${escapeHtml(email)}</p>
            <p><b>Mensaje:</b><br>${escapedMessage}</p>
        `;
};

const buildEmergencyEmailHtml = (
    contact: { name: string; email: string; message: string; lang: string },
    errorMessage: string,
) => {
    const escapeHtml = (value: string) =>
        value.replace(/[&<>"']/g, (match) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            }[match]!),
        );

    const escapedMessage = escapeHtml(contact.message).replace(/\n/g, '<br>');

    return `
            <p><b>Error:</b> ${escapeHtml(errorMessage)}</p>
            <p><b>Idioma:</b> ${escapeHtml(contact.lang)}</p>
            <p><b>Generado:</b> ${escapeHtml(new Date().toISOString())}</p>
            <hr />
            <p><b>Nombre:</b> ${escapeHtml(contact.name)}</p>
            <p><b>Email:</b> ${escapeHtml(contact.email)}</p>
            <p><b>Mensaje original:</b><br>${escapedMessage}</p>
        `;
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const payload = await parseBody(request);

        const clientIp = getClientIp(request);
        if (clientIp) {
            const store = getRateLimitStore();
            const now = Date.now();

            for (const [key, value] of store.entries()) {
                if (value.expiresAt <= now) {
                    store.delete(key);
                }
            }

            const entry = store.get(clientIp);

            if (entry && entry.expiresAt > now) {
                if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
                    return json(
                        request,
                        { error: 'Demasiadas solicitudes, inténtalo de nuevo más tarde.' },
                        429,
                    );
                }

                entry.count += 1;
            } else {
                store.set(clientIp, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
            }
        }

        if (payload.website) {
            // Honeypot activado: responder como si todo hubiese ido bien.
            return json(request, { ok: true });
        }

        if (!payload.name || !payload.email || !payload.message) {
            return json(request, { error: 'Faltan campos' }, 400);
        }

        const trimmedName = payload.name.trim();
        const trimmedEmail = payload.email.trim();
        const trimmedMessage = payload.message.trim();

        if (trimmedName.length < 2 || trimmedName.length > 200) {
            return json(request, { error: 'Nombre inválido' }, 400);
        }

        if (!EMAIL_PATTERN.test(trimmedEmail) || trimmedEmail.length > 254) {
            return json(request, { error: 'Email inválido' }, 400);
        }

        if (trimmedMessage.length < 10 || trimmedMessage.length > 5000) {
            return json(request, { error: 'Mensaje inválido' }, 400);
        }

        if (containsForbiddenContent(trimmedName) || containsForbiddenContent(trimmedMessage)) {
            return json(request, { error: 'Contenido inválido' }, 400);
        }

        const trimmed = {
            name: trimmedName,
            email: trimmedEmail,
            message: trimmedMessage,
            lang: normalizeLang(payload.lang),
        };

        const {
            N8N_WEBHOOK_URL,
            RESEND_API_KEY,
            FROM_EMAIL,
            EMERGENCY_FROM_EMAIL,
            RECAPTCHA_SECRET_KEY,
            RECAPTCHA_MIN_SCORE,
            PUBLIC_RECAPTCHA_SITE_KEY,
        } = import.meta.env;

        const toEmailsRaw = import.meta.env.TO_EMAIL;
        const emergencyToEmailsRaw = import.meta.env.EMERGENCY_TO_EMAIL;
        const toEmails = typeof toEmailsRaw === 'string'
            ? toEmailsRaw
                .split(',')
                .map((value) => value.trim())
                .filter((value) => value.length > 0)
            : [];
        const emergencyToEmails = typeof emergencyToEmailsRaw === 'string'
            ? emergencyToEmailsRaw
                .split(',')
                .map((value) => value.trim())
                .filter((value) => value.length > 0)
            : [];
        const fromEmail = typeof FROM_EMAIL === 'string' ? FROM_EMAIL.trim() : '';
        const emergencyFromEmail =
            typeof EMERGENCY_FROM_EMAIL === 'string' ? EMERGENCY_FROM_EMAIL.trim() : '';

        const isWebhookConfigured =
            typeof N8N_WEBHOOK_URL === 'string' && N8N_WEBHOOK_URL.trim().length > 0;
        const isEmailConfigured =
            typeof RESEND_API_KEY === 'string' &&
            RESEND_API_KEY.trim().length > 0 &&
            fromEmail.length > 0 &&
            toEmails.length > 0;
        const isEmergencyEmailConfigured =
            typeof RESEND_API_KEY === 'string' &&
            RESEND_API_KEY.trim().length > 0 &&
            emergencyFromEmail.length > 0 &&
            emergencyToEmails.length > 0;

        if (!isWebhookConfigured && !isEmailConfigured) {
            const disabledMessage = getDisabledMessage(trimmed.lang);
            console.error('Contact form misconfigured: missing N8N webhook and Resend credentials');
            return json(request, { error: disabledMessage }, 503);
        }

        const isRecaptchaConfigured =
            typeof RECAPTCHA_SECRET_KEY === 'string' &&
            RECAPTCHA_SECRET_KEY.length > 0 &&
            typeof PUBLIC_RECAPTCHA_SITE_KEY === 'string' &&
            PUBLIC_RECAPTCHA_SITE_KEY.length > 0;

        if (isRecaptchaConfigured) {
            if (!payload.token) {
                return json(request, { error: 'Validación de seguridad requerida' }, 400);
            }

            const verification = await verifyRecaptcha(
                payload.token,
                RECAPTCHA_SECRET_KEY,
                clientIp,
                RECAPTCHA_MIN_SCORE,
            );

            if (!verification.ok) {
                return json(request, { error: 'No se pudo verificar la solicitud' }, 400);
            }
        }

        if (isWebhookConfigured && N8N_WEBHOOK_URL) {
            await postJson(
                N8N_WEBHOOK_URL,
                {
                    name: trimmed.name,
                    email: trimmed.email,
                    message: trimmed.message,
                    lang: trimmed.lang,
                    source: 'auris.cat',
                },
                {
                    'Content-Type': 'application/json',
                    'X-AURIS-TOKEN': 'required',
                },
            );
        }

        if (isEmailConfigured && RESEND_API_KEY && fromEmail) {
            try {
                await postJson(
                    'https://api.resend.com/emails',
                    {
                        from: fromEmail,
                        to: toEmails,
                        subject: `Nuevo contacto — auris.cat (${trimmed.lang})`,
                        html: buildEmailHtml(trimmed.name, trimmed.email, trimmed.message),
                    },
                    {
                        Authorization: `Bearer ${RESEND_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                );
            } catch (error) {
                const status =
                    typeof error === 'object' && error && 'status' in error
                        ? Number((error as { status?: number }).status)
                        : undefined;

                if (status === 403) {
                    const serviceUnavailableMessage = getServiceUnavailableMessage(trimmed.lang);
                    const errorMessage =
                        error instanceof Error ? error.message : 'Error inesperado al enviar email';
                    console.error('Resend contact email rejected with status 403', errorMessage);

                    if (isEmergencyEmailConfigured && emergencyFromEmail) {
                        try {
                            await postJson(
                                'https://api.resend.com/emails',
                                {
                                    from: emergencyFromEmail,
                                    to: emergencyToEmails,
                                    subject: 'Alerta: error en formulario de contacto (Resend 403)',
                                    html: buildEmergencyEmailHtml(trimmed, errorMessage),
                                },
                                {
                                    Authorization: `Bearer ${RESEND_API_KEY}`,
                                    'Content-Type': 'application/json',
                                },
                            );
                        } catch (emergencyError) {
                            console.error('No se pudo enviar el email de emergencia', emergencyError);
                        }
                    }

                    return json(request, { error: serviceUnavailableMessage }, 503);
                }

                throw error;
            }
        }

        return json(request, { ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error inesperado';
        return json(request, { error: message }, 500);
    }
};

export const OPTIONS: APIRoute = async ({ request }) => {
    const allowedOrigin = resolveAllowedOrigin(request);
    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
            request.headers.get('access-control-request-headers') ?? 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };

    if (allowedOrigin) {
        headers['Access-Control-Allow-Origin'] = allowedOrigin;
        headers.Vary = 'Origin';
    }

    return new Response(null, { status: 204, headers });
};