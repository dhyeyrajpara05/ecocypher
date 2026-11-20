import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_ADMIN, DEMO_PLAYER_PASSWORD } from "../data/seed";
import type { DB } from "../data/types";
import { getState, rpc, type Env } from "./engine";
import { MemoryKV } from "./kv";

const env: Env = { SESSION_SECRET: "test-secret-0123456789", SEED: "demo" };
let kv: MemoryKV;
beforeEach(() => { kv = new MemoryKV(); });

type Body = { v: number; now: number; me: string | null; view: DB; token?: string; result?: unknown; error?: string };
const call = async (token: string | null, method: string, ...args: unknown[]) => (await rpc(kv, env, token, method, args)) as { status: number; body: Body };
const state = async (token: string | null, v = 0, t = 0) => (await getState(kv, env, token, v, t)) as { status: number; body: Body };

async function adminToken() {
  const r = await call(null, "login", DEMO_ADMIN.username, DEMO_ADMIN.password);
  expect(r.status).toBe(200);
  return r.body.token!;
}
async function playerToken() {
  const r = await call(null, "loginMember", "t4", "t4-u1", DEMO_PLAYER_PASSWORD);
  return r.body.token!;
}

describe("server", () => {
  it("never sends flag hashes, password hashes, unreleased challenges or locked hints to players", async () => {
    const p = await playerToken();
    const { body } = await state(p);
    const text = JSON.stringify(body.view);
    expect(body.view.challenges.every((c) => !c.flagHash && !c.flagSalt)).toBe(true);
    expect(body.view.users.every((u) => !u.passwordHash)).toBe(true);
    expect(body.view.challenges.find((c) => c.id === "c6")).toBeUndefined();   // scheduled
    expect(body.view.challenges.find((c) => c.id === "c8")).toBeUndefined();   // draft
    expect(text).not.toContain("Ignore the haulier");                            // locked hint text
    expect(body.view.users.some((u) => u.role === "admin")).toBe(false);
  }, 30_000);

  it("an admin's change reaches a player on their next check", async () => {
    const a = await adminToken();
    const p = await playerToken();
    const before = await state(p);
    expect((await state(p, before.body.v, before.body.now)).status).toBe(204);  // nothing new
    await call(a, "resetTimer");
    const after = await state(p, before.body.v, before.body.now);
    expect(after.status).toBe(200);
    expect(after.body.view.settings.startsAt).toBeNull();
    await call(a, "setRelease", "c8", new Date(Date.now() - 1000).toISOString());
    expect((await state(p, after.body.v, after.body.now)).body.view.challenges.some((c) => c.id === "c8")).toBe(true);
    await call(a, "setRelease", "c8", null);
    expect((await state(p)).body.view.challenges.some((c) => c.id === "c8")).toBe(false);
  }, 30_000);

  it("refreshes players when a scheduled challenge opens, even with no new writes", async () => {
    const a = await adminToken();
    const p = await playerToken();
    await call(a, "setRelease", "c8", new Date(Date.now() + 50).toISOString());
    const s = await state(p);
    expect(s.body.view.challenges.some((c) => c.id === "c8")).toBe(false);
    await new Promise((r) => setTimeout(r, 80));
    const s2 = await state(p, s.body.v, s.body.now);
    expect(s2.status).toBe(200);
    expect(s2.body.view.challenges.some((c) => c.id === "c8")).toBe(true);
  }, 30_000);

  it("checks flags on the server and refuses forged tokens and player admin calls", async () => {
    const p = await playerToken();
    expect((await call(p, "submitFlag", "c7", "ECO{wrong}")).body.result).toMatchObject({ correct: false });
    expect((await call(p, "startTimer")).body.error).toMatch(/Only admins/);
    expect((await call(p, "loadDemo")).status).toBe(403);
    const forged = p.replace(/^t4-u1/, "u-admin");
    expect((await call(forged, "startTimer")).body.error).toMatch(/Log in first/);
    expect((await call(p, "nope")).status).toBe(400);
  }, 30_000);

  it("keeps both changes when two admin actions race", async () => {
    const a = await adminToken();
    await Promise.all([call(a, "postNotification", "One", "", "info"), call(a, "postNotification", "Two", "", "info")]);
    const titles = (await state(a)).body.view.notifications.map((n) => n.title);
    expect(titles).toEqual(expect.arrayContaining(["One", "Two"]));
  }, 30_000);
});

describe("database settings", () => {
  it("finds the Upstash keys whatever prefix Vercel gave them", async () => {
    const { kvFromEnv, UpstashKV } = await import("./kv");
    const kv = kvFromEnv({ STORAGE_KV_REST_API_URL: "https://x.upstash.io", STORAGE_KV_REST_API_READ_ONLY_TOKEN: "ro", STORAGE_KV_REST_API_TOKEN: "rw" });
    expect(kv).toBeInstanceOf(UpstashKV);
    expect((kv as unknown as { token: string }).token).toBe("rw");
    expect(() => kvFromEnv({})).toThrow(/No database/);
  });
});
