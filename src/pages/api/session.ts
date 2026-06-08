import type { APIRoute } from "astro";
import { getSession } from "../../lib/session";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
    const session = await getSession(cookies);
    return new Response(JSON.stringify(session), {
        headers: { "content-type": "application/json" },
    });
};
