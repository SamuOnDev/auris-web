import type { APIRoute } from "astro";
import { requireRole } from "../../../lib/session";
import { createUser, getUser, listUsers, type UserRole } from "../../../lib/users";

export const prerender = false;

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;

export const GET: APIRoute = async ({ cookies }) => {
    const s = await requireRole(cookies, "admin");
    if (!s.authed) return json({ ok: false, error: "No autorizado" }, 401);
    const users = await listUsers();
    return json({ ok: true, users });
};

export const POST: APIRoute = async ({ request, cookies }) => {
    const s = await requireRole(cookies, "admin");
    if (!s.authed) return json({ ok: false, error: "No autorizado" }, 401);
    let body: { username?: string; password?: string; role?: UserRole };
    try {
        body = await request.json();
    } catch {
        return json({ ok: false, error: "JSON inválido" }, 400);
    }
    const username = (body.username ?? "").trim();
    const password = body.password ?? "";
    const role: UserRole = body.role === "admin" ? "admin" : "editor";
    if (!USERNAME_RE.test(username)) {
        return json({ ok: false, error: "Usuario inválido (3-32 chars, alfanumérico, _ o -)" }, 400);
    }
    if (password.length < 12) {
        return json({ ok: false, error: "Contraseña mínima 12 caracteres" }, 400);
    }
    if (await getUser(username)) {
        return json({ ok: false, error: "El usuario ya existe" }, 409);
    }
    const u = await createUser({ username, password, role });
    return json({
        ok: true,
        user: { username: u.username, role: u.role, createdAt: u.createdAt, updatedAt: u.updatedAt },
    });
};

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}
