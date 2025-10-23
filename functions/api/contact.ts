export interface Env {
  N8N_WEBHOOK_URL: string;    // p.ej. https://tu-n8n/webhook/auris?token=SECRETO
  RESEND_API_KEY: string;     // opcional: si quieres email de aviso
  TO_EMAIL: string;           // p.ej. contacto@auris.es
  FROM_EMAIL: string;         // p.ej. "Auris Web <no-reply@auris.es>"
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { name, email, message, website, lang } = body || {};
        if (website) return json({ ok: true }); // honeypot
        if (!name || !email || !message) return json({ error: 'Faltan campos' }, 400);

        // 1) Enviar a n8n (si está configurado)
        if (env.N8N_WEBHOOK_URL) {
        await fetch(env.N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-AURIS-TOKEN': 'required' },
            body: JSON.stringify({ name, email, message, lang: lang || 'es', source: 'auris.es' })
        });
        }

        // 2) Aviso por email (opcional, si configuras Resend)
        if (env.RESEND_API_KEY && env.TO_EMAIL && env.FROM_EMAIL) {
        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
            },
            body: JSON.stringify({
            from: env.FROM_EMAIL,
            to: [env.TO_EMAIL],
            subject: `Nuevo contacto — auris.es (${lang || 'es'})`,
            html: `<p><b>Nombre:</b> ${escapeHtml(name)}</p>
                    <p><b>Email:</b> ${escapeHtml(email)}</p>
                    <p><b>Mensaje:</b><br>${escapeHtml(message)}</p>`
            })
        });
        }

        return json({ ok: true });
    } catch (e: any) {
        return json({ error: e?.message || 'Error inesperado' }, 500);
    }
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!));
}
