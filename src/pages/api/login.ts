import type { APIRoute } from "astro";
import { checkCredentials, issueSession } from "../../lib/session";
import { consumeRateLimit, resetRateLimit } from "../../lib/users";

export const prerender = false;

function clientIp(request: Request): string {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const real = request.headers.get("x-real-ip");
    if (real) return real.trim();
    return "unknown";
}

export const POST: APIRoute = async ({ request, cookies }) => {
    let body: { user?: string; pass?: string };
    try {
        body = await request.json();
    } catch {
        return json({ ok: false, error: "Invalid body" }, 400);
    }
    const user = (body.user ?? "").trim();
    const pass = body.pass ?? "";
    if (!user || !pass) return json({ ok: false, error: "Faltan credenciales" }, 400);

    const ip = clientIp(request);
    const limit = await consumeRateLimit(ip, user);
    if (!limit.ok) {
        return json(
            { ok: false, error: `Demasiados intentos. Reintenta en ${limit.retryAfter}s.` },
            429,
            { "retry-after": String(limit.retryAfter) },
        );
    }

    const result = await checkCredentials(user, pass);
    if (!result.ok || !result.user || result.epoch == null) {
        return json({ ok: false, error: result.error ?? "Credenciales incorrectas" }, 401);
    }
    await resetRateLimit(ip, user);
    issueSession(cookies, result.user, result.epoch);
    return json({ ok: true });
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json", ...extraHeaders },
    });
}
