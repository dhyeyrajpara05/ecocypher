import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_ADMIN, DEMO_PLAYER_PASSWORD } from "../data/seed";
import { finalStandings, scoreboard } from "../data/scoring";
import type { DB } from "../data/types";
import { getState, rpc, type Env } from "./engine";
import { MemoryKV } from "./kv";

const env: Env = { SESSION_SECRET: "test-secret-0123456789", SEED: "demo" };
let kv: MemoryKV;
beforeEach(() => { kv = new MemoryKV(); });
type Body = { view: DB; result?: unknown; error?: string };
const call = async (token: string | null, method: string, ...args: unknown[]) => (await rpc(kv, env, token, method, args)) as { status: number; body: Body };
const view = async (token: string | null) => ((await getState(kv, env, token, 0, 0)) as { body: Body }).body.view;
const adminTok = async () => {
  const t = ((await call(null, "login", DEMO_ADMIN.username, DEMO_ADMIN.password)).body as unknown as { token: string }).token;
  return ((await call(t, "changePassword", DEMO_ADMIN.password, "a-new-admin-password")).body as unknown as { token: string }).token;
};
const player = async () => ((await call(null, "loginMember", "t4", "t4-u1", DEMO_PLAYER_PASSWORD)).body as unknown as { token: string }).token;

describe("final results", () => {
  it("combines scaled CTF and judges' average with the chosen weights", async () => {
    const a = await adminTok();
    const v0 = await view(a);
    const [t1, t2] = v0.teams;
    await call(a, "updateFinals", { ctfWeight: 40, pitchMax: 10, judges: [{ id: "j-aaaa1", name: "Asha" }, { id: "j-bbbb2", name: "Ben" }],
      scores: { [t1.id]: { "j-aaaa1": 8, "j-bbbb2": 6 }, [t2.id]: { "j-aaaa1": 10 } } });
    const v = await view(a);
    const rows = finalStandings(v);
    const ctf = scoreboard(v), top = Math.max(...ctf.map((r) => r.score));
    const r1 = rows.find((r) => r.teamId === t1.id)!, s1 = ctf.find((r) => r.teamId === t1.id)!;
    expect(r1.pitchAvg).toBe(7);
    expect(r1.combined).toBeCloseTo(.4 * (s1.score / top * 100) + .6 * 70, 0);
    expect(rows.find((r) => r.teamId === t2.id)!.pitchScaled).toBe(100);
    expect(rows.map((r) => r.rank)).toEqual([...rows.map((r) => r.rank)].sort((x, y) => x - y));
    expect((await call(a, "updateFinals", { scores: { [t1.id]: { "j-aaaa1": 11 } } })).body.error).toMatch(/between 0 and 10/);
    expect((await call(a, "updateFinals", { ctfWeight: 120 })).body.error).toMatch(/0 and 100/);
  }, 30_000);

  it("keeps judges, scores and results away from players until published, then shows only the frozen standings", async () => {
    const a = await adminTok();
    const t1 = (await view(a)).teams[0];
    await call(a, "updateFinals", { judges: [{ id: "j-aaaa1", name: "Secret Judge" }], scores: { [t1.id]: { "j-aaaa1": 9 } } });
    const p = await player();
    for (const tok of [null, p]) { const v = await view(tok); expect(v.finals).toBeUndefined(); expect(JSON.stringify(v)).not.toContain("Secret Judge"); }
    expect((await call(p, "publishFinals", true)).body.error).toMatch(/Only admins/);
    const notes = (await view(a)).notifications.length;
    await call(a, "publishFinals", true);
    const pv = await view(p);
    expect(pv.finals?.published).toBe(true);
    expect(pv.finals?.snapshot?.length).toBe(pv.teams.length);
    expect(pv.finals?.judges).toEqual([]);
    expect(JSON.stringify(pv)).not.toContain("Secret Judge");
    expect((await view(a)).notifications.length).toBe(notes + 1);
    // later score changes don't reach players until the admin updates the published results
    await call(a, "updateFinals", { scores: { [t1.id]: { "j-aaaa1": 1 } } });
    const before = (await view(p)).finals!.snapshot!.find((r) => r.teamId === t1.id)!.pitchAvg;
    expect(before).toBe(9);
    await call(a, "publishFinals", true);
    expect((await view(p)).finals!.snapshot!.find((r) => r.teamId === t1.id)!.pitchAvg).toBe(1);
    expect((await view(a)).notifications.length).toBe(notes + 1);   // only one announcement
    await call(a, "publishFinals", false);
    expect((await view(p)).finals).toBeUndefined();
  }, 30_000);
});
