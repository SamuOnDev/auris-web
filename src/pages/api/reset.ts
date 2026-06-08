import type { APIRoute } from "astro";
import { isAuthed } from "../../lib/session";
import { resetCms } from "../../lib/cms-store";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
    if (!(await isAuthed(cookies))) {
        return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
            status: 401,
            headers: { "content-type": "application/json" },
        });
    }
    const data = await resetCms();
    return new Response(JSON.stringify({ ok: true, data }), {
        headers: { "content-type": "application/json" },
    });
};
