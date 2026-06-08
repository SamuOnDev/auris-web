import type { APIRoute } from "astro";
import { isAuthed } from "../../lib/session";

export const prerender = false;

const HAS_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export const POST: APIRoute = async ({ request, cookies }) => {
    if (!(await isAuthed(cookies))) return json({ ok: false, error: "No autorizado" }, 401);
    if (!HAS_BLOB) {
        return json(
            {
                ok: false,
                error:
                    "Vercel Blob no configurado. Define BLOB_READ_WRITE_TOKEN en .env / Vercel para activar la subida.",
            },
            501,
        );
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ ok: false, error: "Archivo ausente" }, 400);
    const safeName = sanitize(file.name) || `upload-${Date.now()}`;
    const { put } = await import("@vercel/blob");
    const blob = await put(`cms/${Date.now()}-${safeName}`, file, {
        access: "public",
        contentType: file.type || undefined,
        addRandomSuffix: false,
    });
    return json({ ok: true, url: blob.url });
};

function sanitize(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-");
}

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json" },
    });
}
