import type { APIRoute } from 'astro';

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

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

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
        throw new Error(`Request to ${url} failed with status ${response.status}`);
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
                    return json({ error: 'Demasiadas solicitudes, inténtalo de nuevo más tarde.' }, 429);
                }

                entry.count += 1;
            } else {
                store.set(clientIp, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
            }
        }

        if (payload.website) {
            // Honeypot activado: responder como si todo hubiese ido bien.
            return json({ ok: true });
        }

        if (!payload.name || !payload.email || !payload.message) {
            return json({ error: 'Faltan campos' }, 400);
        }

        const trimmedName = payload.name.trim();
        const trimmedEmail = payload.email.trim();
        const trimmedMessage = payload.message.trim();

        if (trimmedName.length < 2 || trimmedName.length > 200) {
            return json({ error: 'Nombre inválido' }, 400);
        }

        if (!EMAIL_PATTERN.test(trimmedEmail) || trimmedEmail.length > 254) {
            return json({ error: 'Email inválido' }, 400);
        }

        if (trimmedMessage.length < 10 || trimmedMessage.length > 5000) {
            return json({ error: 'Mensaje inválido' }, 400);
        }

        if (containsForbiddenContent(trimmedName) || containsForbiddenContent(trimmedMessage)) {
            return json({ error: 'Contenido inválido' }, 400);
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
            RECAPTCHA_SECRET_KEY,
            RECAPTCHA_MIN_SCORE,
            PUBLIC_RECAPTCHA_SITE_KEY,
        } = import.meta.env;

        const toEmail = import.meta.env.TO_EMAIL ?? 'mrsamupanda@gmail.com';

        const isRecaptchaConfigured =
            typeof RECAPTCHA_SECRET_KEY === 'string' &&
            RECAPTCHA_SECRET_KEY.length > 0 &&
            typeof PUBLIC_RECAPTCHA_SITE_KEY === 'string' &&
            PUBLIC_RECAPTCHA_SITE_KEY.length > 0;

        if (isRecaptchaConfigured) {
            if (!payload.token) {
                return json({ error: 'Validación de seguridad requerida' }, 400);
            }

            const verification = await verifyRecaptcha(
                payload.token,
                RECAPTCHA_SECRET_KEY,
                clientIp,
                RECAPTCHA_MIN_SCORE,
            );

            if (!verification.ok) {
                return json({ error: 'No se pudo verificar la solicitud' }, 400);
            }
        }

        if (N8N_WEBHOOK_URL) {
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

        if (RESEND_API_KEY && toEmail && FROM_EMAIL) {
            await postJson(
                'https://api.resend.com/emails',
                {
                    from: FROM_EMAIL,
                    to: [toEmail],
                    subject: `Nuevo contacto — auris.cat (${trimmed.lang})`,
                    html: buildEmailHtml(trimmed.name, trimmed.email, trimmed.message),
                },
                {
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            );
        }

        return json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error inesperado';
        return json({ error: message }, 500);
    }
};