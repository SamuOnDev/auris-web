import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CmsData, LocaleOverrides } from "./cms-types";
import { buildDefaults } from "./cms-defaults";

const KV_KEY = "cms:v1";

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const HAS_KV = Boolean(KV_URL && KV_TOKEN);

let cachedKv: { get: (k: string) => Promise<unknown>; set: (k: string, v: unknown) => Promise<unknown> } | null = null;

async function getKv() {
    if (cachedKv) return cachedKv;
    const mod = await import("@vercel/kv");
    cachedKv = mod.kv as NonNullable<typeof cachedKv>;
    return cachedKv;
}

const __filename = fileURLToPath(import.meta.url);
const localFile = join(dirname(__filename), "..", "..", ".cache", "cms.json");

async function readLocal(): Promise<CmsData | null> {
    try {
        const raw = await fs.readFile(localFile, "utf8");
        return JSON.parse(raw) as CmsData;
    } catch {
        return null;
    }
}

async function writeLocal(data: CmsData): Promise<void> {
    await fs.mkdir(dirname(localFile), { recursive: true });
    await fs.writeFile(localFile, JSON.stringify(data, null, 2), "utf8");
}

export async function loadCms(): Promise<CmsData> {
    const defaults = buildDefaults();
    try {
        if (HAS_KV) {
            const kv = await getKv();
            const stored = (await kv.get(KV_KEY)) as Partial<CmsData> | null;
            if (!stored) return defaults;
            return mergeWithDefaults(stored, defaults);
        }
        const local = await readLocal();
        if (!local) return defaults;
        return mergeWithDefaults(local, defaults);
    } catch (err) {
        console.error("[cms-store] load failed, falling back to defaults", err);
        return defaults;
    }
}

export async function saveCms(data: CmsData): Promise<void> {
    if (HAS_KV) {
        const kv = await getKv();
        await kv.set(KV_KEY, data);
        return;
    }
    await writeLocal(data);
}

export async function resetCms(): Promise<CmsData> {
    const defaults = buildDefaults();
    await saveCms(defaults);
    return defaults;
}

function mergeWithDefaults(stored: Partial<CmsData>, defaults: CmsData): CmsData {
    const images = { ...defaults.images, ...(stored.images ?? {}) };

    const storedText = stored.text ?? {};
    const text: Record<string, LocaleOverrides> = {};
    const langs = new Set<string>([...Object.keys(defaults.text), ...Object.keys(storedText)]);
    for (const lang of langs) {
        text[lang] = { ...(defaults.text[lang] ?? {}), ...(storedText[lang] ?? {}) };
    }

    return { images, text };
}

export const cmsStorageMode = HAS_KV ? "kv" : "local-file";
