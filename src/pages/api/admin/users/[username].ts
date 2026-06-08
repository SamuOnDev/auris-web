import type { APIRoute } from "astro";
import { requireRole } from "../../../../lib/session";
import {
    countAdmins,
    deleteUser,
    getUser,
    updateUserPassword,
    updateUserRole,
    type UserRole,
} from "../../../../lib/users";

export const prerender = false;

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
    const s = await requireRole(cookies, "admin");
    if (!s.authed) return json({ ok: false, error: "No autorizado" }, 401);
    const target = params.username;
    if (!target) return json({ ok: false, error: "Falta username" }, 400);
    const existing = await getUser(target);
    if (!existing) return json({ ok: false, error: "Usuario no encontrado" }, 404);
    let body: { password?: string; role?: UserRole };
    try {
        body = await request.json();
    } catch {
        return json({ ok: false, error: "JSON inválido" }, 400);
    }
    if (body.password != null) {
        if (body.password.length < 12) {
            return json({ ok: false, error: "Contraseña mínima 12 caracteres" }, 400);
        }
        await updateUserPassword(target, body.password);
    }
    if (body.role != null) {
        const role: UserRole = body.role === "admin" ? "admin" : "editor";
        if (existing.role === "admin" && role !== "admin") {
            const admins = await countAdmins();
            if (admins <= 1) {
                return json({ ok: false, error: "No se puede degradar al último admin" }, 400);
            }
        }
        await updateUserRole(target, role);
    }
    return json({ ok: true });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
    const s = await requireRole(cookies, "admin");
    if (!s.authed || !s.user) return json({ ok: false, error: "No autorizado" }, 401);
    const target = params.username;
    if (!target) return json({ ok: false, error: "Falta username" }, 400);
    if (target === s.user) return json({ ok: false, error: "No puedes borrarte a ti mismo" }, 400);
    const existing = await getUser(target);
    if (!existing) return json({ ok: false, error: "Usuario no encontrado" }, 404);
    if (existing.role === "admin") {
        const admins = await countAdmins();
        if (admins <= 1) {
            return json({ ok: false, error: "No se puede borrar al último admin" }, 400);
        }
    }
    await deleteUser(target);
    return json({ ok: true });
};

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}
