/* =====================================================
 * Admin SPA — talks to the server API (/api/cms, /api/upload,
 * /api/login, ...). Base model: texts + images.
 *
 * What it renders is driven by src/lib/editable-fields.ts.
 * Adding a repeatable collection? See docs/04-extensions.md.
 * ===================================================== */
import type { CmsData } from "../lib/cms-types";
import {
    TEXT_GROUPS,
    IMAGE_SLOTS,
    type EditableTextField,
    type EditableImageSlot,
} from "../lib/editable-fields";
import { SUPPORTED as LANGS, DEFAULT_LANG, getDict, type ActiveLang } from "../i18n";

type Route = "editor" | "dashboard" | "textos" | "imagenes" | "usuarios" | "ajustes";
type UserRole = "admin" | "editor";
interface CurrentSession { user: string; role: UserRole; }
interface AdminUser { username: string; role: UserRole; createdAt: number; updatedAt: number; }

const $ = <T extends Element = Element>(s: string, root: ParentNode = document) =>
    root.querySelector(s) as T | null;
const $$ = <T extends Element = Element>(s: string, root: ParentNode = document) =>
    Array.from(root.querySelectorAll(s)) as T[];

let cms: CmsData = { images: {}, text: {} };
let currentRoute: Route = "dashboard";
let textLang: ActiveLang = DEFAULT_LANG;
let currentSession: CurrentSession | null = null;

// Default text per language, shown as the greyed-out placeholder in the editor.
// Built from the site's i18n dictionaries (string values only; nested objects ignored).
const fallbackText: Record<string, Record<string, string>> = {};
for (const lang of LANGS) {
    fallbackText[lang] = dictAsStrings(getDict(lang) as unknown as Record<string, unknown>);
}

function dictAsStrings(d: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of Object.keys(d)) {
        const v = d[k];
        if (typeof v === "string") out[k] = v;
    }
    return out;
}

function escapeHtml(s: unknown): string {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c),
    );
}
function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function flashSaved() {
    const b = $("#saveBadge") as HTMLElement | null;
    if (!b) return;
    b.hidden = false;
    clearTimeout((flashSaved as any)._t);
    (flashSaved as any)._t = setTimeout(() => (b.hidden = true), 1800);
}

async function persist(): Promise<void> {
    const res = await fetch("/api/cms", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cms),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert("Error al guardar: " + (body.error || res.status));
        return;
    }
    flashSaved();
}

/**
 * Downscale + re-encode an image in the browser before uploading. Vercel serverless
 * functions reject request bodies over ~4.5 MB (HTTP 413), and full-resolution photos
 * are far too heavy for the web anyway. We cap the longest side and export WebP, which
 * preserves transparency (logos) and keeps files tiny. Falls back to the original file
 * for SVGs or if the canvas pipeline is unavailable.
 */
async function prepareUpload(file: File): Promise<File> {
    if (file.type === "image/svg+xml" || !file.type.startsWith("image/")) return file;
    const MAX_DIM = 2200;
    const MAX_KEEP_BYTES = 3.5 * 1024 * 1024;
    try {
        const bitmap = await createImageBitmap(file);
        const longest = Math.max(bitmap.width, bitmap.height);
        const scale = Math.min(1, MAX_DIM / longest);
        if (scale === 1 && file.size <= MAX_KEEP_BYTES) {
            bitmap.close?.();
            return file;
        }
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            bitmap.close?.();
            return file;
        }
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close?.();
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
        if (!blob) return file;
        const base = file.name.replace(/\.[^.]+$/, "") || "image";
        return new File([blob], `${base}.webp`, { type: "image/webp" });
    } catch {
        return file;
    }
}

async function uploadFile(file: File): Promise<string | null> {
    const prepared = await prepareUpload(file);
    const form = new FormData();
    form.append("file", prepared);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (res.status === 413) {
        alert("La imagen es demasiado grande. Prueba con una más ligera.");
        return null;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
        alert(body.error || "Error al subir la imagen");
        return null;
    }
    return body.url as string;
}

/* ── LOGIN ────────────────────────────────────────────── */
function mountLogin() {
    const form = $("#loginForm") as HTMLFormElement | null;
    if (!form) return;
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = ($("#loginUser") as HTMLInputElement).value.trim();
        const pass = ($("#loginPass") as HTMLInputElement).value;
        const err = $("#loginError") as HTMLElement;
        err.textContent = "";
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ user, pass }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) {
            err.textContent = body.error || "Error al iniciar sesión";
            ($("#loginPass") as HTMLInputElement).value = "";
            ($("#loginPass") as HTMLInputElement).focus();
            return;
        }
        ($("#loginScreen") as HTMLElement).hidden = true;
        ($("#adminApp") as HTMLElement).hidden = false;
        await bootApp();
    });
}

/* ── ROUTING ──────────────────────────────────────────── */
const ROUTES: Record<Route, { title: string; render: (root: HTMLElement) => void; requiresAdmin?: boolean }> = {
    editor: { title: "Editar web", render: renderEditor },
    dashboard: { title: "Resumen", render: renderDashboard },
    textos: { title: "Textos", render: renderTextos },
    imagenes: { title: "Imágenes", render: renderImagenes },
    usuarios: { title: "Usuarios", render: renderUsuarios, requiresAdmin: true },
    ajustes: { title: "Ajustes", render: renderAjustes },
};

/* ── EDITOR VISUAL (clic-para-editar sobre la web real) ── */
let editorLang: ActiveLang = DEFAULT_LANG;
let editorPath = "/";

const EDITOR_PAGES: Array<{ label: string; path: string }> = [
    { label: "Inicio", path: "/" },
    { label: "Quiénes somos", path: "/about" },
    { label: "Dónde estamos", path: "/where" },
    { label: "Contacto", path: "/contact" },
    { label: "Cookies", path: "/cookies" },
];

// key -> human label, taken from the editable-fields registry; defaults to the key.
const TEXT_LABELS: Record<string, string> = (() => {
    const m: Record<string, string> = {};
    for (const g of TEXT_GROUPS) for (const f of g.fields) m[f.key] = f.label;
    return m;
})();

function editorIframeSrc(): string {
    const base = editorPath === "/" ? `/${editorLang}/` : `/${editorLang}${editorPath}`;
    return `${base}?cmsedit=1`;
}

function renderEditor(root: HTMLElement) {
    const langTabs = LANGS.map(
        (l) => `<button class="tab ${editorLang === l ? "active" : ""}" data-elang="${l}">${l.toUpperCase()}</button>`,
    ).join("");
    const pageTabs = EDITOR_PAGES.map(
        (p) => `<button class="ed-page ${editorPath === p.path ? "active" : ""}" data-epath="${escapeHtml(p.path)}">${escapeHtml(p.label)}</button>`,
    ).join("");
    root.innerHTML = `
        <div class="editor-bar">
            <div class="ed-pages">${pageTabs}</div>
            <div class="ed-right">
                <span class="ed-hint">Haz clic en cualquier texto o imagen de la web para editarlo.</span>
                ${LANGS.length > 1 ? `<div class="tabs">${langTabs}</div>` : ""}
            </div>
        </div>
        <div class="editor-frame-wrap">
            <iframe id="editorFrame" class="editor-frame" src="${editorIframeSrc()}"></iframe>
        </div>
    `;
    root.querySelectorAll<HTMLElement>(".ed-page[data-epath]").forEach((b) =>
        b.addEventListener("click", () => {
            editorPath = b.dataset.epath as string;
            navigate("editor");
        }),
    );
    root.querySelectorAll<HTMLElement>(".tab[data-elang]").forEach((b) =>
        b.addEventListener("click", () => {
            editorLang = b.dataset.elang as ActiveLang;
            navigate("editor");
        }),
    );
    const frame = root.querySelector("#editorFrame") as HTMLIFrameElement;
    frame.addEventListener("load", () => attachEditorOverlay(frame));
}

function attachEditorOverlay(frame: HTMLIFrameElement) {
    const doc = frame.contentDocument;
    if (!doc) return;
    if (!doc.getElementById("cms-ed-style")) {
        const st = doc.createElement("style");
        st.id = "cms-ed-style";
        st.textContent =
            "[data-cms-key],[data-cms-slot]{outline:1px dashed rgba(195,243,92,.55);outline-offset:2px;cursor:pointer;transition:outline-color .15s,background .15s;}" +
            "[data-cms-key]:hover,[data-cms-slot]:hover{outline:2px solid #C3F35C;background:rgba(195,243,92,.12);}";
        doc.head.appendChild(st);
    }
    doc.addEventListener(
        "click",
        (e) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            const textEl = target.closest("[data-cms-key]") as HTMLElement | null;
            if (textEl) {
                e.preventDefault();
                e.stopPropagation();
                openTextEditor(textEl.dataset.cmsKey as string);
                return;
            }
            const imgEl = target.closest("[data-cms-slot]") as HTMLElement | null;
            if (imgEl) {
                e.preventDefault();
                e.stopPropagation();
                openImageEditor(imgEl.dataset.cmsSlot as string);
                return;
            }
            // Keep edit mode while navigating between pages of the same site.
            const link = target.closest("a[href]") as HTMLAnchorElement | null;
            if (link) {
                const href = link.getAttribute("href") || "";
                if (href.startsWith("/") && !href.startsWith("//")) {
                    e.preventDefault();
                    const sep = href.includes("?") ? "&" : "?";
                    frame.src = `${href}${sep}cmsedit=1`;
                }
            }
        },
        true,
    );
    // Never submit forms (e.g. contact) while editing.
    doc.addEventListener("submit", (e) => e.preventDefault(), true);
}

function reloadEditorFrame() {
    const frame = document.getElementById("editorFrame") as HTMLIFrameElement | null;
    if (frame) frame.src = editorIframeSrc();
}

function closeEditorModal() {
    document.getElementById("cmsEditorModal")?.remove();
}

function openTextEditor(key: string) {
    closeEditorModal();
    let lang: ActiveLang = editorLang;
    const label = TEXT_LABELS[key] ?? key;
    const modal = document.createElement("div");
    modal.id = "cmsEditorModal";
    modal.className = "cms-modal";

    const render = () => {
        const value = (cms.text[lang] ?? {})[key] ?? "";
        const fb = (fallbackText[lang] ?? {})[key] ?? "";
        const langTabs = LANGS.map(
            (l) => `<button class="tab ${l === lang ? "active" : ""}" data-mlang="${l}">${l.toUpperCase()}</button>`,
        ).join("");
        modal.innerHTML = `
            <div class="cms-modal-card">
                <div class="cms-modal-head">
                    <div><b>${escapeHtml(label)}</b><span class="mono">${escapeHtml(key)}</span></div>
                    <button class="cms-x" data-close>✕</button>
                </div>
                ${LANGS.length > 1 ? `<div class="tabs">${langTabs}</div>` : ""}
                <textarea class="cms-ta" placeholder="${escapeHtml(fb ? "Por defecto: " + fb : "")}">${escapeHtml(value)}</textarea>
                <div class="cms-modal-foot">
                    <button class="btn ghost" data-restore>Restaurar original</button>
                    <span style="flex:1"></span>
                    <button class="btn ghost" data-close>Cancelar</button>
                    <button class="btn solid" data-save>Guardar</button>
                </div>
            </div>
        `;
        modal.querySelectorAll<HTMLElement>("[data-mlang]").forEach((b) =>
            b.addEventListener("click", () => {
                lang = b.dataset.mlang as ActiveLang;
                render();
            }),
        );
        modal.querySelectorAll<HTMLElement>("[data-close]").forEach((b) => b.addEventListener("click", closeEditorModal));
        const ta = modal.querySelector(".cms-ta") as HTMLTextAreaElement;
        (modal.querySelector("[data-save]") as HTMLElement).addEventListener("click", async () => {
            const v = ta.value;
            if (!cms.text[lang]) cms.text[lang] = {};
            if (v.trim() === "") delete cms.text[lang][key];
            else cms.text[lang][key] = v;
            await persist();
            closeEditorModal();
            reloadEditorFrame();
        });
        (modal.querySelector("[data-restore]") as HTMLElement).addEventListener("click", async () => {
            if (cms.text[lang]) delete cms.text[lang][key];
            await persist();
            closeEditorModal();
            reloadEditorFrame();
        });
    };

    render();
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeEditorModal();
    });
    document.body.appendChild(modal);
}

function openImageEditor(slot: string) {
    closeEditorModal();
    const slotLabel = IMAGE_SLOTS.find((s) => s.slot === slot)?.label ?? slot;
    const current = cms.images[slot] ?? "";
    const modal = document.createElement("div");
    modal.id = "cmsEditorModal";
    modal.className = "cms-modal";
    modal.innerHTML = `
        <div class="cms-modal-card">
            <div class="cms-modal-head">
                <div><b>${escapeHtml(slotLabel)}</b><span class="mono">${escapeHtml(slot)}</span></div>
                <button class="cms-x" data-close>✕</button>
            </div>
            <div class="cms-img-preview">${current ? `<img src="${escapeHtml(current)}" alt="">` : "Sin imagen"}</div>
            <label class="file-btn cms-upload">📷 Subir nueva imagen<input type="file" accept="image/*" id="cmsImgFile" hidden></label>
            <input type="text" class="cms-url" placeholder="o pega una URL (/...)" value="${escapeHtml(current)}">
            <p class="cms-lib-title mono">Biblioteca</p>
            <div class="cms-lib" id="cmsLib"><div class="empty-state"><p>Cargando…</p></div></div>
            <div class="cms-modal-foot">
                <button class="btn ghost" data-restore>Restaurar original</button>
                <span style="flex:1"></span>
                <button class="btn ghost" data-close>Cancelar</button>
                <button class="btn solid" data-save>Guardar</button>
            </div>
        </div>
    `;
    const urlInput = modal.querySelector(".cms-url") as HTMLInputElement;
    const preview = modal.querySelector(".cms-img-preview") as HTMLElement;
    const setUrl = (u: string) => {
        urlInput.value = u;
        preview.innerHTML = u ? `<img src="${escapeHtml(u)}" alt="">` : "Sin imagen";
    };
    modal.querySelectorAll<HTMLElement>("[data-close]").forEach((b) => b.addEventListener("click", closeEditorModal));
    (modal.querySelector("#cmsImgFile") as HTMLInputElement).addEventListener("change", async (e) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (!f) return;
        const uploaded = await uploadFile(f);
        if (uploaded) setUrl(uploaded);
    });
    urlInput.addEventListener("input", () => setUrl(urlInput.value));
    (modal.querySelector("[data-save]") as HTMLElement).addEventListener("click", async () => {
        const v = urlInput.value.trim();
        if (v === "") delete cms.images[slot];
        else cms.images[slot] = v;
        await persist();
        closeEditorModal();
        reloadEditorFrame();
    });
    (modal.querySelector("[data-restore]") as HTMLElement).addEventListener("click", async () => {
        delete cms.images[slot];
        await persist();
        closeEditorModal();
        reloadEditorFrame();
    });
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeEditorModal();
    });
    document.body.appendChild(modal);
    loadEditorLibrary(modal, setUrl);
}

async function loadEditorLibrary(modal: HTMLElement, pick: (u: string) => void) {
    const lib = modal.querySelector("#cmsLib") as HTMLElement;
    try {
        const res = await fetch("/api/blobs");
        const body = (await res.json()) as { ok: boolean; blobs?: Array<{ url: string; pathname: string }>; error?: string };
        if (!res.ok || !body.ok) {
            lib.innerHTML = `<div class="empty-state"><p>${escapeHtml(body.error || "Biblioteca no disponible.")}</p></div>`;
            return;
        }
        const blobs = body.blobs ?? [];
        if (!blobs.length) {
            lib.innerHTML = `<div class="empty-state"><p>Aún no hay imágenes subidas.</p></div>`;
            return;
        }
        lib.innerHTML = "";
        blobs.forEach((b) => {
            const item = document.createElement("button");
            item.className = "cms-lib-item";
            item.innerHTML = `<img src="${escapeHtml(b.url)}" alt="">`;
            item.addEventListener("click", () => pick(b.url));
            lib.appendChild(item);
        });
    } catch {
        lib.innerHTML = `<div class="empty-state"><p>Biblioteca no disponible.</p></div>`;
    }
}

function navigate(route: Route) {
    if (!ROUTES[route]) route = "dashboard";
    if (ROUTES[route].requiresAdmin && currentSession?.role !== "admin") route = "dashboard";
    currentRoute = route;
    $$<HTMLElement>(".side-link").forEach((l) => l.classList.toggle("active", l.dataset.route === route));
    ($("#crumb") as HTMLElement).textContent = ROUTES[route].title;
    ($("#pageTitle") as HTMLElement).textContent = ROUTES[route].title;
    const content = $("#content") as HTMLElement;
    content.innerHTML = "";
    ROUTES[route].render(content);
}

/* ── DASHBOARD ────────────────────────────────────────── */
function countOverrides(): number {
    let n = 0;
    for (const lang of Object.keys(cms.text)) n += Object.keys(cms.text[lang] ?? {}).length;
    return n;
}

function renderDashboard(root: HTMLElement) {
    const imagesSet = Object.values(cms.images).filter(Boolean).length;
    root.innerHTML = `
        <div class="dash-grid">
            <div class="dash-card accent">
                <span class="l">Textos editables</span>
                <span class="n"><b>${TEXT_GROUPS.reduce((a, g) => a + g.fields.length, 0)}</b></span>
                <span class="l">en ${LANGS.length} idioma(s)</span>
            </div>
            <div class="dash-card">
                <span class="l">Overrides guardados</span>
                <span class="n"><b>${countOverrides()}</b></span>
                <span class="l">textos personalizados</span>
            </div>
            <div class="dash-card">
                <span class="l">Imágenes</span>
                <span class="n"><b>${IMAGE_SLOTS.length}</b></span>
                <span class="l">${imagesSet} con valor</span>
            </div>
            <div class="dash-card">
                <span class="l">Idiomas</span>
                <span class="n"><b>${LANGS.length}</b></span>
                <span class="l">${LANGS.join(" · ")}</span>
            </div>
        </div>
        <div class="section-card">
            <h3>Acciones rápidas <small>atajos</small></h3>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button class="btn solid" data-go="textos">Editar textos</button>
                <button class="btn ghost" data-go="imagenes">Editar imágenes</button>
                <a class="btn ghost" href="/" target="_blank">Ver la web →</a>
            </div>
        </div>
    `;
    root.querySelectorAll<HTMLElement>("[data-go]").forEach((b) =>
        b.addEventListener("click", () => navigate(b.dataset.go as Route)),
    );
}

/* ── TEXTOS ───────────────────────────────────────────── */
function renderTextos(root: HTMLElement) {
    if (!TEXT_GROUPS.length) {
        root.innerHTML = '<div class="empty-state"><p>No hay textos editables configurados. Edita <b>src/lib/editable-fields.ts</b>.</p></div>';
        return;
    }
    const langTabs = LANGS.map(
        (l) => `<button class="tab ${textLang === l ? "active" : ""}" data-tlang="${l}">${l.toUpperCase()}</button>`,
    ).join("");
    root.innerHTML = `
        <div class="section-card" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <p style="font-size:13px;color:var(--muted);margin:0">Sobrescribe los textos por idioma. Si dejas un campo vacío, se usa el texto por defecto del diseño.</p>
            ${LANGS.length > 1 ? `<div class="tabs">${langTabs}</div>` : ""}
        </div>
        <div id="textGroups"></div>
    `;
    root.querySelectorAll<HTMLElement>(".tab[data-tlang]").forEach((t) =>
        t.addEventListener("click", () => {
            textLang = t.dataset.tlang as ActiveLang;
            navigate("textos");
        }),
    );
    const overrides = cms.text[textLang] ?? {};
    const fb = fallbackText[textLang] ?? {};
    const wrap = root.querySelector("#textGroups") as HTMLElement;
    TEXT_GROUPS.forEach((group) => {
        const card = document.createElement("div");
        card.className = "section-card";
        const inner = group.fields
            .map((f) => buildTextFieldHtml(f, overrides[f.key] ?? "", fb[f.key] ?? ""))
            .join("");
        card.innerHTML = `<h3>${escapeHtml(group.title)} <small>${group.fields.length} campos</small></h3>${inner}`;
        wrap.appendChild(card);
        card.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-tkey]").forEach((el) => {
            el.addEventListener("change", async () => {
                const key = el.dataset.tkey as string;
                const v = el.value;
                if (!cms.text[textLang]) cms.text[textLang] = {};
                if (v.trim() === "") delete cms.text[textLang][key];
                else cms.text[textLang][key] = v;
                await persist();
            });
        });
    });
}

function buildTextFieldHtml(field: EditableTextField, value: string, fallback: string): string {
    const labelHint = field.allowsHtml ? ' <i>admite &lt;b&gt;</i>' : "";
    const placeholder = fallback ? `por defecto: ${fallback.slice(0, 80)}${fallback.length > 80 ? "…" : ""}` : "";
    if (field.multiline) {
        return `
            <div class="field">
                <label>${escapeHtml(field.label)}${labelHint}</label>
                <textarea data-tkey="${escapeHtml(field.key)}" placeholder="${escapeHtml(placeholder)}" style="min-height:80px">${escapeHtml(value)}</textarea>
            </div>
        `;
    }
    return `
        <div class="field">
            <label>${escapeHtml(field.label)}${labelHint}</label>
            <input type="text" data-tkey="${escapeHtml(field.key)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
        </div>
    `;
}

/* ── IMÁGENES ─────────────────────────────────────────── */
function renderImagenes(root: HTMLElement) {
    root.innerHTML = `
        <div class="section-card">
            <h3>Imágenes de la web <small>${IMAGE_SLOTS.length} huecos</small></h3>
            <div id="slotBlock"></div>
        </div>
        <div class="section-card">
            <h3>Subir archivo <small>se guarda en la biblioteca</small></h3>
            <div class="img-picker">
                <div class="preview" id="libPreview">Selecciona un archivo</div>
                <div class="pick">
                    <input type="file" accept="image/*,video/*" id="libFile" />
                    <label for="libFile" class="file-btn">📷 Elegir archivo</label>
                    <span class="field-hint" id="libStatus">Se sube a Vercel Blob. Copia su URL y pégala en el hueco que quieras.</span>
                </div>
            </div>
        </div>
        <div class="section-card">
            <h3>Biblioteca <small id="libCount">cargando…</small></h3>
            <div class="img-grid" id="libGrid"></div>
        </div>
    `;
    const slotBlock = root.querySelector("#slotBlock") as HTMLElement;
    if (!IMAGE_SLOTS.length) {
        slotBlock.innerHTML = '<div class="empty-state"><p>No hay huecos de imagen configurados. Edita <b>src/lib/editable-fields.ts</b>.</p></div>';
    } else {
        IMAGE_SLOTS.forEach((slot) =>
            slotBlock.appendChild(
                buildImageSlotField(slot, cms.images[slot.slot] ?? "", async (v) => {
                    if (v) cms.images[slot.slot] = v;
                    else delete cms.images[slot.slot];
                    await persist();
                }),
            ),
        );
    }

    const file = root.querySelector("#libFile") as HTMLInputElement;
    const preview = root.querySelector("#libPreview") as HTMLElement;
    const status = root.querySelector("#libStatus") as HTMLElement;
    file.addEventListener("change", async () => {
        const f = file.files?.[0];
        if (!f) return;
        const localUrl = await fileToDataUrl(f);
        preview.innerHTML = `<img src="${localUrl}" alt="">`;
        status.textContent = "Subiendo…";
        const uploaded = await uploadFile(f);
        if (uploaded) {
            status.innerHTML = `Subido: <b style="color:var(--ink);font-family:'Roboto Mono',monospace">${escapeHtml(uploaded)}</b>`;
            await loadAndRenderLibrary(root);
        } else {
            status.textContent = "Error en la subida.";
        }
    });
    loadAndRenderLibrary(root);
}

function buildImageSlotField(slot: EditableImageSlot, value: string, save: (v: string) => Promise<void>): HTMLElement {
    const div = document.createElement("div");
    div.className = "field";
    const id = "slot-" + Math.random().toString(36).slice(2, 8);
    div.innerHTML = `
        <label>${escapeHtml(slot.label)}${slot.hint ? ` <i>${escapeHtml(slot.hint)}</i>` : ""}</label>
        <div class="img-picker">
            <div class="preview">${value ? `<img src="${escapeHtml(value)}" alt="">` : "Sin imagen"}</div>
            <div class="pick">
                <input type="file" accept="image/*" id="${id}" />
                <label for="${id}" class="file-btn">📷 Subir imagen</label>
                <input type="text" value="${escapeHtml(value)}" placeholder="o pega una URL (/images/…)" />
                <small class="mono">${escapeHtml(slot.slot)}</small>
            </div>
        </div>
    `;
    const fileInput = div.querySelector(`#${id}`) as HTMLInputElement;
    const textInput = div.querySelector('input[type="text"]') as HTMLInputElement;
    const preview = div.querySelector(".preview") as HTMLElement;
    fileInput.addEventListener("change", async () => {
        const f = fileInput.files?.[0];
        if (!f) return;
        const localUrl = await fileToDataUrl(f);
        preview.innerHTML = `<img src="${localUrl}" alt="">`;
        const uploaded = await uploadFile(f);
        const finalUrl = uploaded ?? localUrl;
        textInput.value = finalUrl;
        preview.innerHTML = `<img src="${finalUrl}" alt="">`;
        await save(finalUrl);
    });
    textInput.addEventListener("change", async () => {
        const v = textInput.value.trim();
        preview.innerHTML = v ? `<img src="${escapeHtml(v)}" alt="">` : "Sin imagen";
        await save(v);
    });
    return div;
}

async function loadAndRenderLibrary(root: HTMLElement) {
    const grid = root.querySelector("#libGrid") as HTMLElement;
    const count = root.querySelector("#libCount") as HTMLElement;
    grid.innerHTML = '<div class="empty-state"><p>Cargando…</p></div>';
    try {
        const res = await fetch("/api/blobs");
        const body = (await res.json()) as { ok: boolean; blobs?: Array<{ url: string; pathname: string; size: number; uploadedAt: string }>; error?: string };
        if (!res.ok || !body.ok) {
            grid.innerHTML = `<div class="empty-state"><p>${escapeHtml(body.error || "No se pudieron listar los archivos.")}</p></div>`;
            count.textContent = "—";
            return;
        }
        const blobs = body.blobs ?? [];
        count.textContent = `${blobs.length} archivos`;
        if (!blobs.length) {
            grid.innerHTML = '<div class="empty-state"><p>Todavía no hay archivos subidos.</p></div>';
            return;
        }
        grid.innerHTML = "";
        const inUse = new Set<string>(Object.values(cms.images).filter(Boolean));
        blobs.forEach((b) => {
            const isVideo = /\.(mp4|webm|mov)$/i.test(b.pathname);
            const card = document.createElement("div");
            card.className = "img-card";
            const used = inUse.has(b.url);
            card.innerHTML = `
                <div class="ph">${isVideo ? `<video src="${escapeHtml(b.url)}" muted></video>` : `<img src="${escapeHtml(b.url)}" alt="">`}</div>
                <div class="info">
                    <b>${escapeHtml(b.pathname.replace(/^cms\//, ""))}</b>
                    <span>${(b.size / 1024).toFixed(0)} KB · ${used ? "<b style='color:var(--green)'>En uso</b>" : "<span style='color:var(--muted)'>Sin usar</span>"}</span>
                </div>
                <div style="display:flex;gap:6px;padding:0 12px 12px">
                    <button class="btn ghost sm" data-copy="${escapeHtml(b.url)}">Copiar URL</button>
                    <button class="btn danger sm" data-del="${escapeHtml(b.url)}" ${used ? "disabled" : ""}>Eliminar</button>
                </div>
            `;
            grid.appendChild(card);
        });
        grid.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((b) => {
            b.addEventListener("click", () => {
                navigator.clipboard.writeText(b.dataset.copy || "");
                b.textContent = "✓ Copiado";
                setTimeout(() => (b.textContent = "Copiar URL"), 1200);
            });
        });
        grid.querySelectorAll<HTMLButtonElement>("[data-del]").forEach((b) => {
            b.addEventListener("click", async () => {
                if (b.disabled) return;
                const url = b.dataset.del as string;
                if (!confirm(`¿Eliminar este archivo?\n${url}`)) return;
                const res = await fetch("/api/blobs?url=" + encodeURIComponent(url), { method: "DELETE" });
                const body2 = await res.json().catch(() => ({}));
                if (!res.ok || !body2.ok) {
                    alert(body2.error || "Error al eliminar.");
                    return;
                }
                await loadAndRenderLibrary(root);
            });
        });
    } catch (err) {
        grid.innerHTML = `<div class="empty-state"><p>${escapeHtml((err as Error).message)}</p></div>`;
    }
}

/* ── AJUSTES ──────────────────────────────────────────── */
function renderAjustes(root: HTMLElement) {
    const sess = currentSession;
    const sessInfo = sess
        ? `Conectado como <b style="color:var(--ink);font-family:'Roboto Mono',monospace">${escapeHtml(sess.user)}</b> · rol <b style="color:var(--ink)">${escapeHtml(sess.role)}</b>`
        : "Sin sesión";
    root.innerHTML = `
        <div class="section-card">
            <h3>Sesión <small>cuenta de acceso</small></h3>
            <p style="font-size:13px;color:var(--muted);margin-bottom:14px">${sessInfo}</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button class="btn solid" id="changePassBtn">Cambiar mi contraseña</button>
                <button class="btn ghost" id="logoutBtn2">Cerrar sesión</button>
            </div>
        </div>
        <div class="section-card">
            <h3>Datos / mantenimiento <small>zona de cuidado</small></h3>
            <div style="display:flex;flex-direction:column;gap:10px">
                <button class="btn ghost" id="exportJSON">📥 Exportar contenido (JSON)</button>
                <label class="btn ghost" style="cursor:pointer;width:max-content">
                    📤 Importar contenido (JSON)
                    <input type="file" accept="application/json" id="importJSON" hidden />
                </label>
                <button class="btn danger" id="resetCMS">🗑 Restaurar contenido por defecto</button>
            </div>
        </div>
    `;
    root.querySelector("#exportJSON")?.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(cms, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "cms-" + new Date().toISOString().slice(0, 10) + ".json";
        a.click();
    });
    root.querySelector("#importJSON")?.addEventListener("change", async (e) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (!f) return;
        try {
            const text = await f.text();
            const data = JSON.parse(text) as CmsData;
            if (typeof data.images !== "object" || typeof data.text !== "object") throw new Error("JSON inválido");
            cms = data;
            await persist();
            alert("Contenido importado correctamente.");
            navigate("dashboard");
        } catch (err) {
            alert("No se pudo importar: " + (err as Error).message);
        }
    });
    root.querySelector("#resetCMS")?.addEventListener("click", async () => {
        if (!confirm("Esto restaurará todo el contenido a los valores por defecto. ¿Continuar?")) return;
        const res = await fetch("/api/reset", { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) {
            alert(body.error || "Error al restaurar");
            return;
        }
        cms = body.data as CmsData;
        flashSaved();
        navigate("dashboard");
    });
    root.querySelector("#logoutBtn2")?.addEventListener("click", () => doLogout());
    root.querySelector("#changePassBtn")?.addEventListener("click", () => openChangePasswordModal());
}

function openChangePasswordModal() {
    const existing = document.getElementById("pwModalBg");
    if (existing) existing.remove();
    const bg = document.createElement("div");
    bg.id = "pwModalBg";
    bg.className = "drawer-bg open";
    bg.innerHTML = `
        <aside class="drawer open" role="dialog" aria-modal="true" style="max-width:480px">
            <div class="drawer-head">
                <h3>Cambiar contraseña</h3>
                <button class="icon-btn" id="pwClose" aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
            </div>
            <div class="drawer-body">
                <div class="field">
                    <label>Contraseña actual</label>
                    <input type="password" id="pwCurrent" autocomplete="current-password" />
                </div>
                <div class="field">
                    <label>Nueva contraseña <i>mínimo 12 caracteres</i></label>
                    <input type="password" id="pwNext" autocomplete="new-password" />
                </div>
                <div class="field">
                    <label>Confirmar nueva contraseña</label>
                    <input type="password" id="pwConfirm" autocomplete="new-password" />
                </div>
                <div class="login-error" id="pwError" style="min-height:18px"></div>
                <p class="field-hint">Al cambiar la contraseña se cerrarán todas tus sesiones abiertas. Tendrás que volver a entrar.</p>
            </div>
            <div class="drawer-foot">
                <div style="display:flex;gap:10px;margin-left:auto">
                    <button class="btn ghost" id="pwCancel">Cancelar</button>
                    <button class="btn solid" id="pwSave">Guardar</button>
                </div>
            </div>
        </aside>
    `;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.querySelector("#pwClose")?.addEventListener("click", close);
    bg.querySelector("#pwCancel")?.addEventListener("click", close);
    bg.addEventListener("click", (e) => { if (e.target === bg) close(); });
    bg.querySelector("#pwSave")?.addEventListener("click", async () => {
        const current = ($("#pwCurrent") as HTMLInputElement).value;
        const next = ($("#pwNext") as HTMLInputElement).value;
        const confirmVal = ($("#pwConfirm") as HTMLInputElement).value;
        const err = $("#pwError") as HTMLElement;
        err.textContent = "";
        if (next.length < 12) { err.textContent = "La nueva contraseña debe tener al menos 12 caracteres."; return; }
        if (next !== confirmVal) { err.textContent = "Las contraseñas no coinciden."; return; }
        const res = await fetch("/api/account/password", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ current, next }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) { err.textContent = body.error || "Error al cambiar la contraseña."; return; }
        close();
        alert("Contraseña actualizada. Vuelve a iniciar sesión.");
        await doLogout();
    });
}

/* ── USUARIOS ─────────────────────────────────────────── */
function renderUsuarios(root: HTMLElement) {
    if (currentSession?.role !== "admin") {
        root.innerHTML = '<div class="empty-state"><p>Solo los administradores pueden gestionar usuarios.</p></div>';
        return;
    }
    root.innerHTML = `
        <div class="proj-head">
            <h3 style="margin:0">Usuarios del panel <small>${currentSession ? "tú: " + escapeHtml(currentSession.user) : ""}</small></h3>
            <button class="btn solid" id="newUserBtn">+ Nuevo usuario</button>
        </div>
        <div class="section-card">
            <div id="usersList">Cargando…</div>
        </div>
    `;
    root.querySelector("#newUserBtn")?.addEventListener("click", () => openUserModal(null));
    loadAndRenderUsers(root);
}

async function loadAndRenderUsers(root: HTMLElement) {
    const list = root.querySelector("#usersList") as HTMLElement;
    try {
        const res = await fetch("/api/admin/users");
        const body = (await res.json()) as { ok: boolean; users?: AdminUser[]; error?: string };
        if (!res.ok || !body.ok || !body.users) {
            list.innerHTML = `<div class="empty-state"><p>${escapeHtml(body.error || "Error al cargar usuarios.")}</p></div>`;
            return;
        }
        if (!body.users.length) {
            list.innerHTML = '<div class="empty-state"><p>No hay usuarios.</p></div>';
            return;
        }
        list.innerHTML = "";
        body.users.forEach((u) => list.appendChild(buildUserRow(u, root)));
    } catch (err) {
        list.innerHTML = `<div class="empty-state"><p>${escapeHtml((err as Error).message)}</p></div>`;
    }
}

function buildUserRow(u: AdminUser, root: HTMLElement): HTMLElement {
    const row = document.createElement("div");
    row.className = "proj-row";
    const isSelf = currentSession?.user === u.username;
    row.innerHTML = `
        <div class="thumb" style="display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--muted);font-size:18px">${escapeHtml(u.username.slice(0, 1).toUpperCase())}</div>
        <div class="info">
            <b>${escapeHtml(u.username)} ${isSelf ? '<span style="color:var(--muted);font-weight:400;font-size:11px;text-transform:uppercase;letter-spacing:.06em">tú</span>' : ""}</b>
            <span>Creado ${new Date(u.createdAt).toLocaleDateString("es-ES")}</span>
        </div>
        <div class="meta">
            <select data-role="${escapeHtml(u.username)}">
                <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
                <option value="editor" ${u.role === "editor" ? "selected" : ""}>editor</option>
            </select>
        </div>
        <div class="actions">
            <button class="btn ghost sm" data-resetpass="${escapeHtml(u.username)}">Resetear pwd</button>
            <button class="icon-btn danger" data-deluser="${escapeHtml(u.username)}" title="Eliminar" ${isSelf ? "disabled" : ""}>
                <svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
        </div>
    `;
    row.querySelector(`[data-role="${u.username}"]`)?.addEventListener("change", async (e) => {
        const newRole = (e.target as HTMLSelectElement).value;
        const res = await fetch(`/api/admin/users/${encodeURIComponent(u.username)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ role: newRole }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) {
            alert(body.error || "Error al actualizar el rol.");
            await loadAndRenderUsers(root);
            return;
        }
        flashSaved();
        await loadAndRenderUsers(root);
    });
    row.querySelector(`[data-resetpass="${u.username}"]`)?.addEventListener("click", () => openUserModal(u));
    row.querySelector(`[data-deluser="${u.username}"]`)?.addEventListener("click", async (e) => {
        if ((e.currentTarget as HTMLButtonElement).disabled) return;
        if (!confirm(`¿Eliminar al usuario "${u.username}"?`)) return;
        const res = await fetch(`/api/admin/users/${encodeURIComponent(u.username)}`, { method: "DELETE" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) { alert(body.error || "Error al eliminar."); return; }
        await loadAndRenderUsers(root);
    });
    return row;
}

function openUserModal(editing: AdminUser | null) {
    const existing = document.getElementById("userModalBg");
    if (existing) existing.remove();
    const bg = document.createElement("div");
    bg.id = "userModalBg";
    bg.className = "drawer-bg open";
    bg.innerHTML = `
        <aside class="drawer open" role="dialog" aria-modal="true" style="max-width:480px">
            <div class="drawer-head">
                <h3>${editing ? "Resetear contraseña · " + escapeHtml(editing.username) : "Nuevo usuario"}</h3>
                <button class="icon-btn" id="umClose" aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
            </div>
            <div class="drawer-body">
                ${editing ? "" : `
                <div class="field">
                    <label>Usuario <i>3-32 chars, alfanumérico, _ o -</i></label>
                    <input type="text" id="umUser" autocomplete="off" />
                </div>
                <div class="field">
                    <label>Rol</label>
                    <select id="umRole">
                        <option value="editor">editor</option>
                        <option value="admin">admin</option>
                    </select>
                </div>`}
                <div class="field">
                    <label>${editing ? "Nueva contraseña" : "Contraseña"} <i>mínimo 12 caracteres</i></label>
                    <input type="password" id="umPass" autocomplete="new-password" />
                </div>
                <div class="login-error" id="umError" style="min-height:18px"></div>
                ${editing ? '<p class="field-hint">Al resetear la contraseña, todas las sesiones de este usuario quedan invalidadas.</p>' : ""}
            </div>
            <div class="drawer-foot">
                <div style="display:flex;gap:10px;margin-left:auto">
                    <button class="btn ghost" id="umCancel">Cancelar</button>
                    <button class="btn solid" id="umSave">${editing ? "Resetear" : "Crear usuario"}</button>
                </div>
            </div>
        </aside>
    `;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.querySelector("#umClose")?.addEventListener("click", close);
    bg.querySelector("#umCancel")?.addEventListener("click", close);
    bg.addEventListener("click", (e) => { if (e.target === bg) close(); });
    bg.querySelector("#umSave")?.addEventListener("click", async () => {
        const pass = ($("#umPass") as HTMLInputElement).value;
        const err = $("#umError") as HTMLElement;
        err.textContent = "";
        if (pass.length < 12) { err.textContent = "La contraseña debe tener al menos 12 caracteres."; return; }
        if (editing) {
            const res = await fetch(`/api/admin/users/${encodeURIComponent(editing.username)}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ password: pass }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.ok) { err.textContent = body.error || "Error al resetear."; return; }
        } else {
            const username = ($("#umUser") as HTMLInputElement).value.trim();
            const role = ($("#umRole") as HTMLSelectElement).value;
            if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) { err.textContent = "Usuario inválido."; return; }
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ username, password: pass, role }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.ok) { err.textContent = body.error || "Error al crear."; return; }
        }
        close();
        const content = $("#content") as HTMLElement;
        await loadAndRenderUsers(content);
        flashSaved();
    });
}

async function doLogout() {
    await fetch("/api/logout", { method: "POST" });
    location.reload();
}

/* ── BOOT ─────────────────────────────────────────────── */
async function loadCmsFromServer(): Promise<void> {
    const res = await fetch("/api/cms");
    if (!res.ok) throw new Error("No se pudo cargar el CMS");
    cms = (await res.json()) as CmsData;
    if (!cms.images) cms.images = {};
    if (!cms.text) cms.text = {};
}

async function loadSession(): Promise<void> {
    try {
        const res = await fetch("/api/session");
        const body = (await res.json()) as { authed: boolean; user?: string; role?: UserRole };
        currentSession = body.authed && body.user && body.role ? { user: body.user, role: body.role } : null;
    } catch {
        currentSession = null;
    }
}

function applyRoleVisibility() {
    const isAdmin = currentSession?.role === "admin";
    $$<HTMLElement>(".side-link[data-route='usuarios']").forEach((l) => { l.hidden = !isAdmin; });
}

async function bootApp() {
    await loadSession();
    await loadCmsFromServer();
    applyRoleVisibility();
    $$<HTMLElement>(".side-link").forEach((l) =>
        l.addEventListener("click", () => navigate(l.dataset.route as Route)),
    );
    $("#themeBtn")?.addEventListener("click", () => {
        const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
        const next = cur === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try {
            localStorage.setItem("admin_theme", next);
        } catch {}
    });
    $("#logoutBtn")?.addEventListener("click", () => doLogout());
    navigate("dashboard");
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const t = localStorage.getItem("admin_theme") || "light";
        document.documentElement.setAttribute("data-theme", t);
    } catch {}

    try {
        const res = await fetch("/api/session");
        const body = (await res.json()) as { authed: boolean; user?: string; role?: UserRole };
        if (body.authed) {
            ($("#loginScreen") as HTMLElement).hidden = true;
            ($("#adminApp") as HTMLElement).hidden = false;
            await bootApp();
            return;
        }
    } catch {}
    mountLogin();
});
