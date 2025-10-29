import type { APIRoute } from 'astro';

const SUPPORTED_LANGS = ['es', 'en', 'ca', 'fr', 'de', 'it'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];
const DEFAULT_LANG: SupportedLang = 'es';

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
    };
};

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

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
        (
            {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            }[match]!
        ),
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

        if (payload.website) {
        // Honeypot activado: responder como si todo hubiese ido bien.
        return json({ ok: true });
        }

        if (!payload.name || !payload.email || !payload.message) {
        return json({ error: 'Faltan campos' }, 400);
        }

        const trimmed = {
        name: payload.name.trim(),
        email: payload.email.trim(),
        message: payload.message.trim(),
        lang: normalizeLang(payload.lang),
        };

        const {
        N8N_WEBHOOK_URL,
        RESEND_API_KEY,
        TO_EMAIL,
        FROM_EMAIL,
        } = import.meta.env;

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

        if (RESEND_API_KEY && TO_EMAIL && FROM_EMAIL) {
        await postJson(
            'https://api.resend.com/emails',
            {
            from: FROM_EMAIL,
            to: [TO_EMAIL],
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