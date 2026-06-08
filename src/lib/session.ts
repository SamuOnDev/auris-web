import { createHmac, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";
import { createUser, getUser, userCount, verifyPassword, type UserRole } from "./users";

const COOKIE_NAME = "site_admin";
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SEP = ":";

function secret(): string {
    const s = process.env.SESSION_SECRET;
    if (!s || s.length < 16) {
        throw new Error("SESSION_SECRET is missing or too short. Set it in .env (>= 32 hex chars).");
    }
    return s;
}

function sign(payload: string): string {
    return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
}

export function issueSession(cookies: AstroCookies, user: string, epoch: number): void {
    const issued = Date.now();
    const payload = `${user}${SEP}${issued}${SEP}${epoch}`;
    const sig = sign(payload);
    cookies.set(COOKIE_NAME, `${payload}${SEP}${sig}`, {
        httpOnly: true,
        sameSite: "lax",
        secure: import.meta.env.PROD,
        path: "/",
        maxAge: TTL_SECONDS,
    });
}

export function clearSession(cookies: AstroCookies): void {
    cookies.delete(COOKIE_NAME, { path: "/" });
}

export interface Session {
    authed: boolean;
    user?: string;
    role?: UserRole;
}

export async function getSession(cookies: AstroCookies): Promise<Session> {
    const raw = cookies.get(COOKIE_NAME)?.value;
    if (!raw) return { authed: false };
    const parts = raw.split(SEP);
    if (parts.length !== 4) return { authed: false };
    const [user, issuedStr, epochStr, sig] = parts;
    if (!user || !issuedStr || !epochStr || !sig) return { authed: false };
    const issued = Number(issuedStr);
    const epoch = Number(epochStr);
    if (!Number.isFinite(issued) || !Number.isFinite(epoch)) return { authed: false };
    if (Date.now() - issued > TTL_SECONDS * 1000) return { authed: false };
    const expected = sign(`${user}${SEP}${issuedStr}${SEP}${epochStr}`);
    if (!safeEqual(expected, sig)) return { authed: false };
    const stored = await getUser(user);
    if (!stored) return { authed: false };
    if (stored.sessionEpoch !== epoch) return { authed: false };
    return { authed: true, user: stored.username, role: stored.role };
}

export async function isAuthed(cookies: AstroCookies): Promise<boolean> {
    return (await getSession(cookies)).authed;
}

export async function requireRole(cookies: AstroCookies, role: UserRole): Promise<Session> {
    const s = await getSession(cookies);
    if (!s.authed) return s;
    if (role === "admin" && s.role !== "admin") return { authed: false };
    return s;
}

export interface LoginResult {
    ok: boolean;
    user?: string;
    epoch?: number;
    error?: string;
}

export async function checkCredentials(user: string, pass: string): Promise<LoginResult> {
    const total = await userCount();
    if (total === 0) {
        const envUser = process.env.ADMIN_USER;
        const envPass = process.env.ADMIN_PASSWORD;
        if (envUser && envPass && safeEqual(user, envUser) && safeEqual(pass, envPass)) {
            const seeded = await createUser({ username: user, password: pass, role: "admin" });
            return { ok: true, user: seeded.username, epoch: seeded.sessionEpoch };
        }
        return { ok: false, error: "Credenciales incorrectas" };
    }
    const stored = await getUser(user);
    if (!stored) return { ok: false, error: "Credenciales incorrectas" };
    const valid = await verifyPassword(pass, stored.passwordHash, stored.salt);
    if (!valid) return { ok: false, error: "Credenciales incorrectas" };
    return { ok: true, user: stored.username, epoch: stored.sessionEpoch };
}
