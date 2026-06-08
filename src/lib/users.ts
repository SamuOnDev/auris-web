import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
    password: string | Buffer,
    salt: Buffer,
    keylen: number,
) => Promise<Buffer>;

export type UserRole = "admin" | "editor";

export interface StoredUser {
    username: string;
    passwordHash: string;
    salt: string;
    role: UserRole;
    createdAt: number;
    updatedAt: number;
    sessionEpoch: number;
}

export interface PublicUser {
    username: string;
    role: UserRole;
    createdAt: number;
    updatedAt: number;
}

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const HAS_KV = Boolean(KV_URL && KV_TOKEN);

interface KvClient {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<unknown>;
    del: (key: string) => Promise<unknown>;
    sadd: (key: string, ...members: string[]) => Promise<unknown>;
    srem: (key: string, ...members: string[]) => Promise<unknown>;
    smembers: (key: string) => Promise<string[]>;
    scard: (key: string) => Promise<number>;
    incr: (key: string) => Promise<number>;
    expire: (key: string, seconds: number) => Promise<unknown>;
    ttl: (key: string) => Promise<number>;
}

let cachedKv: KvClient | null = null;
async function getKv(): Promise<KvClient> {
    if (cachedKv) return cachedKv;
    const mod = await import("@vercel/kv");
    cachedKv = mod.kv as unknown as KvClient;
    return cachedKv;
}

const __filename = fileURLToPath(import.meta.url);
const localFile = join(dirname(__filename), "..", "..", ".cache", "users.json");

interface LocalDb {
    users: Record<string, StoredUser>;
    rateLimit: Record<string, { count: number; resetAt: number }>;
}

async function readLocal(): Promise<LocalDb> {
    try {
        const raw = await fs.readFile(localFile, "utf8");
        const parsed = JSON.parse(raw) as Partial<LocalDb>;
        return {
            users: parsed.users ?? {},
            rateLimit: parsed.rateLimit ?? {},
        };
    } catch {
        return { users: {}, rateLimit: {} };
    }
}

async function writeLocal(db: LocalDb): Promise<void> {
    await fs.mkdir(dirname(localFile), { recursive: true });
    await fs.writeFile(localFile, JSON.stringify(db, null, 2), "utf8");
}

const USER_KEY = (u: string) => `auth:user:${u}`;
const INDEX_KEY = "auth:users:index";
const RATE_KEY = (ip: string, u: string) => `auth:ratelimit:login:${ip}:${u}`;

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_S = 15 * 60;

async function hashPassword(password: string): Promise<{ passwordHash: string; salt: string }> {
    const saltBuf = randomBytes(16);
    const hashBuf = await scryptAsync(password, saltBuf, 64);
    return { passwordHash: hashBuf.toString("hex"), salt: saltBuf.toString("hex") };
}

export async function verifyPassword(password: string, passwordHash: string, salt: string): Promise<boolean> {
    const saltBuf = Buffer.from(salt, "hex");
    const expected = Buffer.from(passwordHash, "hex");
    const actual = await scryptAsync(password, saltBuf, expected.length);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
}

function toPublic(u: StoredUser): PublicUser {
    return { username: u.username, role: u.role, createdAt: u.createdAt, updatedAt: u.updatedAt };
}

export async function getUser(username: string): Promise<StoredUser | null> {
    if (HAS_KV) {
        const kv = await getKv();
        return ((await kv.get(USER_KEY(username))) as StoredUser | null) ?? null;
    }
    const db = await readLocal();
    return db.users[username] ?? null;
}

export async function listUsers(): Promise<PublicUser[]> {
    if (HAS_KV) {
        const kv = await getKv();
        const names = (await kv.smembers(INDEX_KEY)) ?? [];
        const users: PublicUser[] = [];
        for (const name of names) {
            const u = (await kv.get(USER_KEY(name))) as StoredUser | null;
            if (u) users.push(toPublic(u));
        }
        return users.sort((a, b) => a.username.localeCompare(b.username));
    }
    const db = await readLocal();
    return Object.values(db.users)
        .map(toPublic)
        .sort((a, b) => a.username.localeCompare(b.username));
}

export async function userCount(): Promise<number> {
    if (HAS_KV) {
        const kv = await getKv();
        return (await kv.scard(INDEX_KEY)) ?? 0;
    }
    const db = await readLocal();
    return Object.keys(db.users).length;
}

export async function countAdmins(): Promise<number> {
    const all = await listUsers();
    return all.filter((u) => u.role === "admin").length;
}

async function persistUser(user: StoredUser): Promise<void> {
    if (HAS_KV) {
        const kv = await getKv();
        await kv.set(USER_KEY(user.username), user);
        await kv.sadd(INDEX_KEY, user.username);
        return;
    }
    const db = await readLocal();
    db.users[user.username] = user;
    await writeLocal(db);
}

export async function createUser(input: { username: string; password: string; role: UserRole }): Promise<StoredUser> {
    const existing = await getUser(input.username);
    if (existing) throw new Error("El usuario ya existe");
    const { passwordHash, salt } = await hashPassword(input.password);
    const now = Date.now();
    const user: StoredUser = {
        username: input.username,
        passwordHash,
        salt,
        role: input.role,
        createdAt: now,
        updatedAt: now,
        sessionEpoch: now,
    };
    await persistUser(user);
    return user;
}

export async function updateUserPassword(username: string, newPassword: string): Promise<StoredUser> {
    const existing = await getUser(username);
    if (!existing) throw new Error("Usuario no encontrado");
    const { passwordHash, salt } = await hashPassword(newPassword);
    const now = Date.now();
    const updated: StoredUser = {
        ...existing,
        passwordHash,
        salt,
        updatedAt: now,
        sessionEpoch: now,
    };
    await persistUser(updated);
    return updated;
}

export async function updateUserRole(username: string, role: UserRole): Promise<StoredUser> {
    const existing = await getUser(username);
    if (!existing) throw new Error("Usuario no encontrado");
    const updated: StoredUser = { ...existing, role, updatedAt: Date.now() };
    await persistUser(updated);
    return updated;
}

export async function deleteUser(username: string): Promise<void> {
    if (HAS_KV) {
        const kv = await getKv();
        await kv.del(USER_KEY(username));
        await kv.srem(INDEX_KEY, username);
        return;
    }
    const db = await readLocal();
    delete db.users[username];
    await writeLocal(db);
}

export interface RateLimitResult {
    ok: boolean;
    remaining: number;
    retryAfter: number;
}

export async function consumeRateLimit(ip: string, username: string): Promise<RateLimitResult> {
    if (HAS_KV) {
        const kv = await getKv();
        const key = RATE_KEY(ip, username);
        const n = await kv.incr(key);
        if (n === 1) await kv.expire(key, RATE_LIMIT_WINDOW_S);
        const ttlRaw = await kv.ttl(key);
        const retryAfter = ttlRaw > 0 ? ttlRaw : RATE_LIMIT_WINDOW_S;
        return { ok: n <= RATE_LIMIT_MAX, remaining: Math.max(0, RATE_LIMIT_MAX - n), retryAfter };
    }
    const db = await readLocal();
    const key = RATE_KEY(ip, username);
    const now = Date.now();
    let entry = db.rateLimit[key];
    if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_S * 1000 };
    }
    entry.count += 1;
    db.rateLimit[key] = entry;
    await writeLocal(db);
    const retryAfter = Math.max(0, Math.ceil((entry.resetAt - now) / 1000));
    return { ok: entry.count <= RATE_LIMIT_MAX, remaining: Math.max(0, RATE_LIMIT_MAX - entry.count), retryAfter };
}

export async function resetRateLimit(ip: string, username: string): Promise<void> {
    if (HAS_KV) {
        const kv = await getKv();
        await kv.del(RATE_KEY(ip, username));
        return;
    }
    const db = await readLocal();
    delete db.rateLimit[RATE_KEY(ip, username)];
    await writeLocal(db);
}
