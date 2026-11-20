/**
 * The EcoCypher server. Runs the exact same rules as the browser version (LocalBackend) but on the
 * server, against one shared database, so every player and the admin see the same event.
 * Flags are checked here; players only ever receive a filtered view (see data/view.ts).
 */
import { BackendError, KEY, LocalBackend, SESSION } from "../data/backend";
import { demoDB, freshDB } from "../data/seed";
import type { DB, User } from "../data/types";
import { publicView, viewChangeTimes } from "../data/view";
import type { KV } from "./kv";

export interface Env { SESSION_SECRET?: string; ADMIN_PASSWORD?: string; SEED?: string }
export interface Reply { status: number; body?: unknown }

/** Everything the browser may call. Anything else is refused. */
const METHODS = new Set([
  "login", "loginMember", "changePassword", "submitFlag", "unlockHint",
  "updateSettings", "startTimer", "extendTimer", "endEventNow", "resetTimer", "updateType",
  "postWave", "saveChallenge", "setRelease", "groupIntoWave", "splitWave", "addAttempts", "deleteChallenge",
  "createTeam", "importTeams", "renameTeam", "deleteTeam", "addMember", "resetPassword", "deleteUser",
  "postNotification", "deleteNotification", "exportJSON", "importJSON", "startFresh", "loadDemo",
]);
const ADMIN_ONLY = new Set(["loadDemo"]);
const TOKEN_HOURS = 14;

class MemStorage implements Storage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

// ------------------------------------------------------------------ sessions (signed tokens)
const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hmac(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}
function secretOf(env: Env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16) throw new Error("SESSION_SECRET is not set (use at least 16 random characters).");
  return env.SESSION_SECRET;
}
/** The token is tied to the password, so resetting a password logs that person out everywhere. */
async function sign(env: Env, u: User) {
  const body = `${u.id}.${Date.now() + TOKEN_HOURS * 3600_000}.${u.passwordHash.slice(0, 12)}`;
  return `${body}.${await hmac(secretOf(env), body)}`;
}
async function verify(env: Env, db: DB, token: string | null): Promise<User | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, exp, fp, sig] = parts;
  if (Number(exp) < Date.now()) return null;
  const want = await hmac(secretOf(env), `${id}.${exp}.${fp}`);
  if (want.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return null;
  const u = db.users.find((x) => x.id === id);
  return u && u.passwordHash.slice(0, 12) === fp ? u : null;
}

// ------------------------------------------------------------------ data
async function load(kv: KV, env: Env): Promise<{ db: DB; raw: string; v: number }> {
  const got = await kv.read();
  if (got.data) return { db: JSON.parse(got.data), raw: got.data, v: got.v };
  let db: DB;
  if (env.SEED === "demo") db = await demoDB();
  else {
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 8) throw new Error("ADMIN_PASSWORD is not set (at least 8 characters).");
    db = await freshDB({ username: "admin", password: env.ADMIN_PASSWORD });
  }
  const raw = JSON.stringify(db);
  if (await kv.write(got.v, raw, viewChangeTimes(db))) return { db, raw, v: got.v + 1 };
  return load(kv, env); // someone else created it first
}

/** Removes secrets from anything sent back to the browser (except the admin's own backup). */
function scrub(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(scrub);
  if (x && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) if (!["passwordHash", "passwordSalt", "flagHash", "flagSalt"].includes(k)) o[k] = scrub(v);
    return o;
  }
  return x;
}

/** GET /api/state?v=<version>&t=<ms of last fetch>. 204 if nothing this person can see has changed. */
export async function getState(kv: KV, env: Env, token: string | null, clientV: number, since: number): Promise<Reply> {
  if (clientV > 0) {
    const meta = await kv.meta();
    const now = Date.now();
    const timeChange = meta.times.some((t) => { const x = Date.parse(t); return x > since && x <= now; });
    if (meta.v === clientV && !timeChange) return { status: 204 };
  }
  const { db, v } = await load(kv, env);
  const me = await verify(env, db, token);
  return { status: 200, body: { v, now: Date.now(), me: me?.id ?? null, view: publicView(db, me), tokenValid: !token || !!me } };
}

/** POST /api/rpc { method, args }. Runs one action as the logged-in person. */
export async function rpc(kv: KV, env: Env, token: string | null, method: string, args: unknown[]): Promise<Reply> {
  if (!METHODS.has(method) || !Array.isArray(args)) return { status: 400, body: { error: "Unknown action." } };
  for (let attempt = 0; attempt < 6; attempt++) {
    const { db, raw, v } = await load(kv, env);
    const me = await verify(env, db, token);
    if (ADMIN_ONLY.has(method) && me?.role !== "admin") return { status: 403, body: { error: "Only admins can do that." } };

    const mem = new MemStorage();
    mem.setItem(KEY, raw);
    if (me) mem.setItem(SESSION, me.id);
    const be = new LocalBackend(mem);
    await be.ready();
    let result: unknown;
    try {
      result = await (be as unknown as Record<string, (...a: unknown[]) => unknown>)[method](...args);
    } catch (e) {
      if (e instanceof BackendError) return { status: 400, body: { error: e.message } };
      throw e;
    }
    await be.flushed();
    const next = be.db();
    const nextRaw = JSON.stringify(next);
    let nv = v;
    if (nextRaw !== JSON.stringify(db)) {
      if (!(await kv.write(v, nextRaw, viewChangeTimes(next)))) continue; // another change landed first: redo on fresh data
      nv = v + 1;
    }
    const sid = mem.getItem(SESSION);
    const who = next.users.find((u) => u.id === sid) ?? null;
    const newToken = sid !== (me?.id ?? null) || method.startsWith("login") || method === "changePassword" ? (who ? await sign(env, who) : "") : undefined;
    return { status: 200, body: {
      result: method === "exportJSON" ? result : scrub(result),
      v: nv, now: Date.now(), me: who?.id ?? null, view: publicView(next, who), token: newToken,
    } };
  }
  return { status: 503, body: { error: "The server is busy. Try again in a moment." } };
}
