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
}

/** Picks the database from environment variables (Vercel's Upstash integration sets either pair). */
export function kvFromEnv(env: Record<string, string | undefined>): KV {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("No database connected. In Vercel, add Upstash Redis from the Storage tab.");
  return new UpstashKV(url, token);
}
