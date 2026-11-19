import { describe, expect, it, beforeEach } from "vitest";
import { LocalBackend, parseCSV } from "./backend";
import { DEMO_ADMIN, DEMO_PLAYER_PASSWORD } from "./seed";
import { roundStatus, scoreboard } from "./scoring";
import type { DB } from "./types";

class MemStorage implements Storage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

let be: LocalBackend;
beforeEach(async () => { be = new LocalBackend(new MemStorage()); await be.ready(); });

describe("scoring", () => {
  it("ranks by score, then by who reached the score first", () => {
    const rows = scoreboard(be.db());
    expect(rows[0].teamName).toBe("Reef Ventures");              // 580
    expect(rows[1].score).toBe(rows[2].score);                     // Kelp Capital and Tidepool Labs both 530
    expect(rows[1].teamName).toBe("Kelp Capital");                 // got to 530 earlier
    expect(rows[2].teamName).toBe("Tidepool Labs");
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });
  it("credits points to the member who solved", () => {
    const kelp = scoreboard(be.db()).find((r) => r.teamName === "Kelp Capital")!;
    expect(kelp.members.reduce((a, m) => a + m.points, 0)).toBe(kelp.score);
    expect(kelp.members[0].points).toBe(300); // Aarav: 100 + 200
  });
  it("counts only the first correct submission per team", () => {
    const db: DB = structuredClone(be.db());
    db.submissions.push({ ...db.submissions[0], id: "dup", at: new Date().toISOString() });
    expect(scoreboard(db)[1].score).toBe(scoreboard(be.db())[1].score);
  });
  it("freeze shows standings at a past moment", () => {
    const early = scoreboard(be.db(), { until: new Date(Date.now() - 82 * 60_000) });
    expect(early[0].teamName).toBe("Tidepool Labs");
    expect(early[0].score).toBe(80);
  });
  it("round status follows state and schedule", () => {
    const now = new Date();
    expect(roundStatus({ id: "x", name: "x", order: 1, state: "draft", opensAt: null, closesAt: null }, now)).toBe("draft");
    expect(roundStatus({ id: "x", name: "x", order: 1, state: "scheduled", opensAt: new Date(Date.now() + 1e6).toISOString(), closesAt: null }, now)).toBe("upcoming");
    expect(roundStatus({ id: "x", name: "x", order: 1, state: "scheduled", opensAt: null, closesAt: new Date(Date.now() - 1).toISOString() }, now)).toBe("closed");
  });
});

describe("players", () => {
  it("rejects a wrong password", async () => {
    await expect(be.login("kelp-capital-1", "nope")).rejects.toThrow(/don't match/);
  });
  it("accepts the right flag once, case-insensitively", async () => {
    await be.login("driftwood-co-1", DEMO_PLAYER_PASSWORD);
    const wrong = await be.submitFlag("c2", "ECO{1}");
    expect(wrong.correct).toBe(false);
    const right = await be.submitFlag("c2", "  eco{42676160} ");
    expect(right).toMatchObject({ correct: true, points: 150 });
    const again = await be.submitFlag("c2", "ECO{42676160}");
    expect(again.alreadySolved).toBe(true);
  });
  it("blocks submissions to rounds that are not open", async () => {
    await be.login("driftwood-co-1", DEMO_PLAYER_PASSWORD);
    const r = await be.submitFlag("c6", "ECO{OKHU3054124}");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/hasn't opened/);
  });
  it("rate-limits rapid guessing", async () => {
    await be.login("driftwood-co-2", DEMO_PLAYER_PASSWORD);
    for (let i = 0; i < 10; i++) await be.submitFlag("c5", `ECO{${i}}`);
    expect((await be.submitFlag("c5", "ECO{x}")).message).toMatch(/Too many/);
  });
  it("players cannot use admin actions", async () => {
    await be.login("kelp-capital-1", DEMO_PLAYER_PASSWORD);
    expect(() => be.createRound("Hack")).toThrow(/Only admins/);
  });
});

describe("admin", () => {
  beforeEach(async () => { await be.login(DEMO_ADMIN.username, DEMO_ADMIN.password); });
  it("creates a team with member logins that work", async () => {
    const creds = await be.createTeam("Plankton Partners", ["A", "B", "C"]);
    expect(creds.map((c) => c.username)).toEqual(["plankton-partners-1", "plankton-partners-2", "plankton-partners-3"]);
    be.logout();
    const u = await be.login(creds[1].username, creds[1].password);
    expect(u.mustChangePassword).toBe(true);
  });
  it("imports a wave from CSV into a round and reports bad rows", async () => {
    const r = be.createRound("Series C");
    const csv = 'title,type,points,flag,description,files\n"Bin Day",osint,120,ECO{a},"Find it, fast",map|https://x/y.png\nNo type,unknown,10,ECO{b},,\nBad pts,Python,zero,ECO{c},,';
    const rep = await be.importChallenges(r.id, csv);
    expect(rep.added).toBe(1);
    expect(rep.errors).toHaveLength(2);
    const c = be.db().challenges.find((x) => x.title === "Bin Day")!;
    expect(c.roundId).toBe(r.id);
    expect(c.files).toEqual([{ name: "map", url: "https://x/y.png" }]);
    expect(c.description).toBe("Find it, fast");
  });
  it("imports a wave from JSON", async () => {
    const r = be.createRound("Series D");
    const rep = await be.importChallenges(r.id, JSON.stringify([{ title: "J1", type: "type-2", points: 50, flag: "ECO{j}" }]));
    expect(rep).toEqual({ added: 1, errors: [] });
  });
  it("never stores flags in plain text", async () => {
    await be.saveChallenge(null, { roundId: "r-seed", typeId: "type-1", title: "Secret", description: "", points: 10, flag: "ECO{super-secret}", caseSensitive: false, files: [], hint: "", hidden: false });
    expect(JSON.stringify(be.db())).not.toContain("super-secret");
  });
  it("renames the four challenge types", () => {
    be.updateType("type-4", { name: "Forensics" });
    expect(be.db().types.map((t) => t.name)).toEqual(["OSINT", "Python", "Data & SQL", "Forensics"]);
  });
  it("refuses a backup with no admin", () => {
    const d = JSON.parse(be.exportJSON());
    d.users = d.users.filter((u: { role: string }) => u.role !== "admin");
    expect(() => be.importJSON(JSON.stringify(d))).toThrow(/locked out/);
  });
});

describe("csv", () => {
  it("handles quotes and commas", () => {
    expect(parseCSV('a,"b, c","d ""q"""\n1,2,3')).toEqual([["a", "b, c", 'd "q"'], ["1", "2", "3"]]);
  });
});
