import type { APIRoute } from "astro";
import { isAuthed } from "../../lib/session";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
    if (!(await isAuthed(cookies))) return json({ ok: false, error: "No autorizado" }, 401);
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
        return json(
            {
                ok: false,
                error:
                    "Vercel Blob no configurado. Define BLOB_READ_WRITE_TOKEN en .env / Vercel para activar la subida.",
            },
            501,
        );
    }
    let file: FormDataEntryValue | null;
    try {
        const form = await request.formData();
        file = form.get("file");
    } catch (err) {
        return json({ ok: false, error: "No se pudo leer el archivo: " + (err as Error).message }, 400);
    }
    if (!(file instanceof File)) return json({ ok: false, error: "Archivo ausente" }, 400);
    const safeName = sanitize(file.name) || `upload-${Date.now()}`;
    try {
        const { put } = await import("@vercel/blob");
        const blob = await put(`cms/${Date.now()}-${safeName}`, file, {
            access: "public",
            contentType: file.type || undefined,
            addRandomSuffix: false,
            token,
        });
        return json({ ok: true, url: blob.url });
    } catch (err) {
        // Surface the real reason (auth/store/network) instead of an opaque 500.
        return json({ ok: false, error: "Blob: " + ((err as Error).message || String(err)) }, 500);
    }
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
