import type { APIRoute } from "astro";
import { getSession, issueSession } from "../../../lib/session";
import { getUser, updateUserPassword, verifyPassword } from "../../../lib/users";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
    const session = await getSession(cookies);
    if (!session.authed || !session.user) {
        return json({ ok: false, error: "No autorizado" }, 401);
    }
    let body: { current?: string; next?: string };
    try {
        body = await request.json();
    } catch {
        return json({ ok: false, error: "JSON inválido" }, 400);
    }
    const current = body.current ?? "";
    const next = body.next ?? "";
    if (next.length < 12) {
        return json({ ok: false, error: "La nueva contraseña debe tener al menos 12 caracteres" }, 400);
    }
    if (current === next) {
        return json({ ok: false, error: "La nueva contraseña debe ser distinta" }, 400);
    }
    const stored = await getUser(session.user);
    if (!stored) return json({ ok: false, error: "Usuario no encontrado" }, 404);
    const valid = await verifyPassword(current, stored.passwordHash, stored.salt);
    if (!valid) return json({ ok: false, error: "La contraseña actual no es correcta" }, 400);
    const updated = await updateUserPassword(session.user, next);
    issueSession(cookies, updated.username, updated.sessionEpoch);
    return json({ ok: true });
};

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}
