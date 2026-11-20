/** Turns HTTP requests into engine calls. Shared by the Vercel functions and the local dev server. */
import { getSound, getState, rpc, type Env, type Reply } from "./engine";
import type { KV } from "./kv";

declare const process: { env: Record<string, string | undefined> };
declare const Buffer: { from(b: Uint8Array): unknown };

export interface Req { method: string; path: string; query: URLSearchParams; auth: string | null; body: unknown }

export async function handle(kv: KV, env: Env, req: Req): Promise<Reply> {
  const token = req.auth?.startsWith("Bearer ") ? req.auth.slice(7) : null;
  try {
    if (req.path.endsWith("/api/state") && req.method === "GET") {
      return await getState(kv, env, token, Number(req.query.get("v")) || 0, Number(req.query.get("t")) || 0);
    }
    if (req.path.endsWith("/api/sound") && req.method === "GET") {
      const s = await getSound(kv, req.query.get("id") ?? "");
      return s.status === 200 ? { status: 200, raw: { mime: s.mime!, bytes: s.bytes! } } : { status: 404, body: { error: "Sound not found." } };
    }
    if (req.path.endsWith("/api/rpc") && req.method === "POST") {
      const b = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {}) as { method?: string; args?: unknown[] };
      return await rpc(kv, env, token, String(b.method), b.args ?? []);
    }
    return { status: 404, body: { error: "Not found." } };
  } catch (e) {
    console.error(e);
    return { status: 500, body: { error: (e as Error).message || "Server error." } };
  }
}

/** Adapter for Node-style (req, res), as used by Vercel functions. */
export function nodeHandler(getKV: () => KV) {
  return async (req: { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }, res: {
    status(n: number): { json(b: unknown): void; end(b?: unknown): void }; setHeader(k: string, v: string): void;
  }) => {
    const url = new URL(req.url ?? "/", "http://x");
    const auth = req.headers.authorization;
    let out: Reply;
    try {
      out = await handle(getKV(), process.env as Env, {
        method: req.method ?? "GET", path: url.pathname, query: url.searchParams, auth: Array.isArray(auth) ? auth[0] : auth ?? null, body: req.body,
      });
    } catch (e) { out = { status: 500, body: { error: (e as Error).message } }; }
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (out.raw) {
      res.setHeader("Content-Type", out.raw.mime);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.status(200).end(Buffer.from(out.raw.bytes));
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    if (out.body === undefined) res.status(out.status).end();
    else res.status(out.status).json(out.body);
  };
}
