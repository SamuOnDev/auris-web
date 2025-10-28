type ContactContext = {
    request: Request;
    env: Env;
};

type ContactPayload = {
    name: string;
    email: string;
    message: string;
    website?: string;
    lang?: string;
};

export interface Env {
    N8N_WEBHOOK_URL?: string;
    RESEND_API_KEY?: string;
    TO_EMAIL?: string;
    FROM_EMAIL?: string;
}

export const onRequestPost = async ({ request, env }: ContactContext) => {
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

        // 1) Enviar a n8n (si está configurado)
        if (env.N8N_WEBHOOK_URL) {
            await postJson(env.N8N_WEBHOOK_URL, {
                name: trimmed.name,
                email: trimmed.email,
                message: trimmed.message,
                lang: trimmed.lang,
                source: 'auris.es',
            }, {
                'Content-Type': 'application/json',
                'X-AURIS-TOKEN': 'required',
            });
        }

        // 2) Aviso por email (opcional, si configuras Resend)
        if (env.RESEND_API_KEY && env.TO_EMAIL && env.FROM_EMAIL) {
            await postJson('https://api.resend.com/emails', {
                from: env.FROM_EMAIL,
                to: [env.TO_EMAIL],
                subject: `Nuevo contacto — auris.es (${trimmed.lang})`,
                html: buildEmailHtml(trimmed.name, trimmed.email, trimmed.message),
            }, {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            });
        }

        return json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error inesperado';
        return json({ error: message }, 500);
    }
};

async function parseBody(request: Request): Promise<ContactPayload> {
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
}

async function postJson(url: string, payload: unknown, headers: HeadersInit) {
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Request to ${url} failed with status ${response.status}`);
    }
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function toStringField(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function toOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

const SUPPORTED_LANGS = ['es', 'en', 'ca', 'fr', 'de', 'it'] as const;
type SupportedLang = typeof SUPPORTED_LANGS[number];
const DEFAULT_LANG: SupportedLang = 'es';

function normalizeLang(value?: string): SupportedLang {
    if (!value) {
        return DEFAULT_LANG;
    }

    const base = value.toLowerCase().split('-')[0];
    return (SUPPORTED_LANGS as readonly string[]).includes(base)
        ? (base as SupportedLang)
        : DEFAULT_LANG;
}

function buildEmailHtml(name: string, email: string, message: string) {
    const escapedMessage = escapeHtml(message).replace(/\n/g, '<br>');
    return `
        <p><b>Nombre:</b> ${escapeHtml(name)}</p>
        <p><b>Email:</b> ${escapeHtml(email)}</p>
        <p><b>Mensaje:</b><br>${escapedMessage}</p>
    `;
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (match) => (
        {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[match]!
    ));
}