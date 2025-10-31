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
@@ -212,50 +220,54 @@ export const POST: APIRoute = async ({ request }) => {
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
            TO_EMAIL,
            FROM_EMAIL,
            RECAPTCHA_SECRET_KEY,
            RECAPTCHA_MIN_SCORE,
        } = import.meta.env;

        if (RECAPTCHA_SECRET_KEY) {
            if (!payload.token) {
                return json({ error: 'Validación de seguridad requerida' }, 400);
            }

            const verification = await verifyRecaptcha(payload.token, RECAPTCHA_SECRET_KEY, clientIp, RECAPTCHA_MIN_SCORE);

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