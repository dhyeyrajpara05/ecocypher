import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_ADMIN, DEMO_PLAYER_PASSWORD } from "../data/seed";
import { scoreboard } from "../data/scoring";
import type { Challenge, DB, TesterChallenge } from "../data/types";
import { getFile, getState, rpc, type Env } from "./engine";
import { MemoryKV } from "./kv";

const env: Env = { SESSION_SECRET: "test-secret-0123456789", SEED: "demo" };
let kv: MemoryKV;
beforeEach(() => { kv = new MemoryKV(); });

type Body = { v: number; view: DB; token?: string; result?: unknown; error?: string };
const call = async (token: string | null, method: string, ...args: unknown[]) => (await rpc(kv, env, token, method, args)) as { status: number; body: Body };
const view = async (token: string | null) => ((await getState(kv, env, token, 0, 0)) as { body: Body }).body.view;
const admin = async () => (await call(null, "login", DEMO_ADMIN.username, DEMO_ADMIN.password)).body.token!;
const player = async () => (await call(null, "loginMember", "t4", "t4-u1", DEMO_PLAYER_PASSWORD)).body.token!;
const blank = { typeId: "", theme: "plastics", description: "Find it", points: 50, caseSensitive: false, files: [], hints: [{ text: "Look closely", cost: 5 }], maxAttempts: 0, hidden: false };

describe("archive and bulk actions", () => {
  it("archiving takes a challenge out of play and off the scoreboard; restore brings it back", async () => {
    const a = await admin();
    await call(a, "startTimer");
    const before = scoreboard(await view(a));
    const solved = (await view(a)).submissions.find((s) => s.correct)!;
    const r = await call(a, "bulkChallenges", "archive", [solved.challengeId]);
    expect(r.body.result).toEqual({ changed: 1, skipped: 0 });
    const team = (rows: ReturnType<typeof scoreboard>) => rows.find((x) => x.teamId === solved.teamId)!.score;
    expect(team(scoreboard(await view(a)))).toBeLessThan(team(before));
    const p = await player();
    expect((await view(p)).challenges.some((c) => c.id === solved.challengeId)).toBe(false);
    expect((await call(a, "setRelease", solved.challengeId, new Date().toISOString())).body.error).toMatch(/archived/);
    await call(a, "bulkChallenges", "restore", [solved.challengeId]);
    expect(team(scoreboard(await view(a)))).toBe(team(before));
  }, 30_000);

  it("bulk release, unpublish and delete act on many challenges in one save and skip archived ones", async () => {
    const a = await admin();
    const ids = (await view(a)).challenges.slice(0, 3).map((c) => c.id);
    await call(a, "bulkChallenges", "archive", [ids[0]]);
    const v0 = (await view(a));
    const vBefore = (await call(a, "bulkChallenges", "unpublish", ids)).body;
    expect(vBefore.result).toEqual({ changed: 2, skipped: 1 });
    expect(vBefore.view.challenges.filter((c) => ids.includes(c.id) && !c.archivedAt).every((c) => c.releaseAt === null)).toBe(true);
    const rel = await call(a, "bulkChallenges", "release", ids);
    expect(rel.body.result).toEqual({ changed: 2, skipped: 1 });
    expect(rel.body.v).toBe(vBefore.v + 1);
    expect((await call(a, "bulkChallenges", "schedule", ids, new Date(Date.now() - 1000).toISOString())).body.error).toMatch(/future/);
    await call(a, "bulkChallenges", "delete", ids);
    const left = (await view(a)).challenges;
    expect(left.length).toBe(v0.challenges.length - 3);
    expect((await call(await player(), "bulkChallenges", "delete", [left[0].id])).body.error).toMatch(/Only admins/);
  }, 30_000);
});

describe("testing page", () => {
  it("needs the admin or the testing password, shows every status and checks flags without recording", async () => {
    const a = await admin();
    const typeId = (await view(a)).types[0].id;
    const made = (await call(a, "saveChallenge", null, { ...blank, typeId, title: "Draft one", flag: "ECO{test-flag}" }, null)).body.result as Challenge;
    expect((await call(null, "testerChallenges", "")).body.error).toMatch(/testing password/);
    expect((await call(a, "setTesterPassword", "abc")).body.error).toMatch(/6 characters/);
    const set = await call(a, "setTesterPassword", "tester-pass");
    expect(set.body.view.testerEnabled).toBe(true);
    expect(JSON.stringify(set.body.view)).not.toContain('"tester"');
    expect(JSON.stringify(await view(null))).not.toContain("tester");
    expect((await call(null, "testerChallenges", "wrong-pass")).body.error).toMatch(/testing password/);
    const list = (await call(null, "testerChallenges", "tester-pass")).body.result as TesterChallenge[];
    const mine = list.find((c) => c.id === made.id)!;
    expect(mine.status).toBe("draft");
    expect(mine.hints[0].text).toBe("Look closely");
    expect(JSON.stringify(list)).not.toMatch(/flagHash|flagSalt/);
    const subs = (await view(a)).submissions.length;
    expect((await call(null, "testerCheckFlag", "tester-pass", made.id, "eco{test-flag}")).body.result).toEqual({ correct: true });
    expect((await call(null, "testerCheckFlag", "tester-pass", made.id, "ECO{nope}")).body.result).toEqual({ correct: false });
    expect((await view(a)).submissions.length).toBe(subs);
    await call(a, "setTesterPassword", "");
    expect((await call(null, "testerChallenges", "tester-pass")).body.error).toMatch(/testing password/);
  }, 60_000);
});

describe("private challenge files", () => {
  it("serves a handout only to the admin, a tester, or a team that can see the challenge", async () => {
    const a = await admin();
    const typeId = (await view(a)).types[0].id;
    const up = await call(a, "uploadFile", "answers.zip", "data:application/zip;base64,UEsDBAo=");
    const file = up.body.result as { name: string; url: string };
    expect(file.url).toMatch(/^\/api\/file\?id=f[a-z0-9]+$/);
    expect((await call(await player(), "uploadFile", "x.txt", "data:text/plain;base64,aGk=")).body.error).toMatch(/Only admins/);
    const id = file.url.split("=")[1];
    const c = (await call(a, "saveChallenge", null, { ...blank, typeId, title: "Has a file", flag: "ECO{x}", files: [file] }, null)).body.result as Challenge;
    const p = await player();
    expect((await getFile(kv, env, null, id, null)).status).toBe(401);
    expect((await getFile(kv, env, p, id, null)).status).toBe(404);                    // draft: not yet
    const got = await getFile(kv, env, a, id, null);
    expect(got.status).toBe(200);
    expect(got.raw?.download).toBe("answers.zip");
    expect(new TextDecoder().decode(got.raw!.bytes)).toBe("PK\u0003\u0004\n");
    await call(a, "setTesterPassword", "tester-pass");
    expect((await getFile(kv, env, null, id, "tester-pass")).status).toBe(200);
    await call(a, "startTimer");
    await call(a, "bulkChallenges", "release", [c.id]);
    expect((await getFile(kv, env, p, id, null)).status).toBe(200);                    // live: allowed
    expect((await getFile(kv, env, p, "../etc", null)).status).toBe(404);
    expect((await call(a, "uploadFile", "big.bin", `data:application/octet-stream;base64,${"A".repeat(4_300_000)}`)).body.error).toMatch(/limit is 3 MB/);
  }, 60_000);
});
