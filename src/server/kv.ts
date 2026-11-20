/**
 * Where the shared data lives. On Vercel this is an Upstash Redis database (added from the Vercel
 * Marketplace); locally and in tests it is memory. Every write is compare-and-set on a version number,
 * so two admins (or a submission and an admin action) never overwrite each other.
 */
export interface Meta { v: number; times: string[] }
export interface KV {
  read(): Promise<{ data: string | null; v: number }>;
  meta(): Promise<Meta>;
  /** Saves only if the stored version is still `expectV`. Returns false if someone else wrote first. */
  write(expectV: number, data: string, times: string[]): Promise<boolean>;
  /** Large values kept apart from the main data (uploaded sounds), so polling stays small. */
  getBlob(name: string): Promise<string | null>;
  putBlob(name: string, value: string): Promise<void>;
  delBlob(name: string): Promise<void>;
}

const DATA = "ecocypher:data";
const META = "ecocypher:meta";
const encodeMeta = (v: number, times: string[]) => `${v}|${times.join(",")}`;
const decodeMeta = (s: string | null): Meta => {
  if (!s) return { v: 0, times: [] };
  const [v, t] = s.split("|");
  return { v: Number(v) || 0, times: t ? t.split(",") : [] };
};

export class MemoryKV implements KV {
  data: string | null = null;
  m: string | null = null;
  async read() { return { data: this.data, v: decodeMeta(this.m).v }; }
  async meta() { return decodeMeta(this.m); }
  async write(expectV: number, data: string, times: string[]) {
    if (decodeMeta(this.m).v !== expectV) return false;
    this.data = data;
    this.m = encodeMeta(expectV + 1, times);
    return true;
  }
  blobs = new Map<string, string>();
  async getBlob(name: string) { return this.blobs.get(name) ?? null; }
  async putBlob(name: string, value: string) { this.blobs.set(name, value); }
  async delBlob(name: string) { this.blobs.delete(name); }
}

const CAS = `local m = redis.call('GET', KEYS[2])
local cur = 0
if m then cur = tonumber(string.match(m, '^(%d+)')) end
if cur ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
return 1`;

/** Upstash Redis over its REST API (no extra package needed). */
export class UpstashKV implements KV {
  constructor(private url: string, private token: string) {}
  private async call(path: string, body: unknown) {
    const r = await fetch(this.url.replace(/\/$/, "") + path, {
      method: "POST", headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Database error ${r.status}: ${await r.text()}`);
    return r.json();
  }
  async read() {
    const [d, m] = (await this.call("/pipeline", [["GET", DATA], ["GET", META]])) as { result: string | null }[];
    return { data: d.result, v: decodeMeta(m.result).v };
  }
  async meta() {
    const r = (await this.call("", ["GET", META])) as { result: string | null };
    return decodeMeta(r.result);
  }
  async write(expectV: number, data: string, times: string[]) {
    const r = (await this.call("", ["EVAL", CAS, "2", DATA, META, String(expectV), data, encodeMeta(expectV + 1, times)])) as { result: number };
    return r.result === 1;
  }
  async getBlob(name: string) { return ((await this.call("", ["GET", `ecocypher:blob:${name}`])) as { result: string | null }).result; }
  async putBlob(name: string, value: string) { await this.call("", ["SET", `ecocypher:blob:${name}`, value]); }
  async delBlob(name: string) { await this.call("", ["DEL", `ecocypher:blob:${name}`]); }
}

/**
 * Picks the database from environment variables. Vercel's Upstash integration names them with
 * whatever prefix was chosen when connecting, and newer setups may only give a rediss:// URL, so:
 *  1. any variable ending in REST_API_URL / REST_API_TOKEN (or REDIS_REST_URL / _TOKEN), else
 *  2. an https://….upstash.io URL with a matching *_TOKEN variable, else
 *  3. a rediss://default:<token>@<host> URL (Upstash uses the same token for REST).
 */
export function kvFromEnv(env: Record<string, string | undefined>): KV {
  const keys = Object.keys(env).sort();
  const find = (...ends: string[]) => {
    for (const end of ends) {
      if (env[end]) return env[end];
      const key = keys.find((k) => k.endsWith(`_${end}`) && !k.includes("READ_ONLY") && env[k]);
      if (key) return env[key];
    }
    return undefined;
  };
  let url = find("KV_REST_API_URL", "REST_API_URL", "UPSTASH_REDIS_REST_URL", "REDIS_REST_URL");
  let token = find("KV_REST_API_TOKEN", "REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN", "REDIS_REST_TOKEN");

  if (!url || !token) {
    for (const k of keys) {
      const v = env[k] ?? "";
      if (/^https:\/\/[^/]+\.upstash\.io/.test(v)) {
        const t = env[k.replace(/URL$/, "TOKEN")];
        if (t && !k.includes("READ_ONLY")) { url = v; token = t; break; }
      }
    }
  }
  if (!url || !token) {
    for (const k of keys) {
      const v = env[k] ?? "";
      if (!/^rediss?:\/\//.test(v)) continue;
      try {
        const u = new URL(v);
        if (u.password && u.hostname.endsWith("upstash.io")) { url = `https://${u.hostname}`; token = decodeURIComponent(u.password); break; }
      } catch { /* not a URL */ }
    }
  }
  if (!url || !token) {
    const seen = keys.filter((k) => /KV|REDIS|UPSTASH|STORAGE/.test(k));
    throw new Error(`No database connected. In Vercel, add Upstash Redis from the Storage tab, then redeploy.${seen.length ? ` (Database variables found: ${seen.join(", ")})` : " (No database variables found in this deployment.)"}`);
  }
  return new UpstashKV(url, token);
}
