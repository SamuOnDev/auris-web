import type { APIRoute } from "astro";
import { isAuthed } from "../../lib/session";

export const prerender = false;

const HAS_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

interface ListedBlob {
    url: string;
    pathname: string;
    size: number;
    uploadedAt: string;
}

export const GET: APIRoute = async ({ cookies }) => {
    if (!(await isAuthed(cookies))) return json({ ok: false, error: "No autorizado" }, 401);
    if (!HAS_BLOB) return json({ ok: false, error: "Vercel Blob no configurado." }, 501);
    try {
        const { list } = await import("@vercel/blob");
        const result = await list({ prefix: "cms/" });
        const blobs: ListedBlob[] = result.blobs.map((b) => ({
            url: b.url,
            pathname: b.pathname,
            size: b.size,
            uploadedAt: typeof b.uploadedAt === "string" ? b.uploadedAt : b.uploadedAt.toISOString(),
        }));
        blobs.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
        return json({ ok: true, blobs });
    } catch (err) {
        return json({ ok: false, error: (err as Error).message }, 500);
    }
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
    if (!(await isAuthed(cookies))) return json({ ok: false, error: "No autorizado" }, 401);
    if (!HAS_BLOB) return json({ ok: false, error: "Vercel Blob no configurado." }, 501);
    const target = url.searchParams.get("url");
    if (!target) return json({ ok: false, error: "Falta el parámetro url" }, 400);
    try {
        const { del } = await import("@vercel/blob");
        await del(target);
        return json({ ok: true });
    } catch (err) {
        return json({ ok: false, error: (err as Error).message }, 500);
    }
};

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}
