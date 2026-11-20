import { beforeEach, describe, expect, it } from "vitest";
import { LocalBackend, migrate, parseCSV, type ChallengeInput } from "./backend";
import { DEMO_ADMIN, DEMO_PLAYER_PASSWORD } from "./seed";
import { attemptsLeft, releaseStatus, scoreboard, visibleChallenges } from "./scoring";
import type { Cipher } from "./vault";
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

const input = (title: string, flag: string, points = 100): ChallengeInput =>
  ({ typeId: "type-1", theme: "water", title, description: "d", points, flag, caseSensitive: false, files: [], hints: [], maxAttempts: 0, hidden: false });

let be: LocalBackend;
beforeEach(async () => { be = new LocalBackend(new MemStorage()); await be.ready(); });

async function asAdmin() { await be.login(DEMO_ADMIN.username, DEMO_ADMIN.password); }

describe("scoring", () => {
  it("ranks by score, then by who reached the score first", () => {
    const rows = scoreboard(be.db());
    expect(rows[0].teamName).toBe("Reef Ventures");
    expect(rows[1].score).toBe(rows[2].score);
    expect(rows[1].teamName).toBe("Kelp Capital");      // reached 530 earlier
    expect(rows[2].teamName).toBe("Tidepool Labs");
  });
  it("credits points to the member who solved, and they add up to the team", () => {
    const kelp = scoreboard(be.db()).find((r) => r.teamName === "Kelp Capital")!;
    expect(kelp.members.reduce((a, m) => a + m.points, 0)).toBe(kelp.score);
    expect(kelp.members).toHaveLength(3);
  });
  it("counts only the first correct submission per team", () => {
    const db: DB = structuredClone(be.db());
    db.submissions.push({ ...db.submissions[0], id: "dup", at: new Date().toISOString() });
    expect(scoreboard(db)[1].score).toBe(scoreboard(be.db())[1].score);
  });
  it("hides drafts and scheduled challenges from players", () => {
    const ids = visibleChallenges(be.db()).map((c) => c.id);
    expect(ids).toContain("c7");
    expect(ids).not.toContain("c6"); // scheduled
    expect(ids).not.toContain("c8"); // draft
    expect(releaseStatus(be.db().challenges.find((c) => c.id === "c6")!)).toBe("scheduled");
  });
});

describe("team login", () => {
  it("each member logs in with their own password and plays for their team", async () => {
    const u = await be.loginMember("t1", "t1-u2", DEMO_PLAYER_PASSWORD);
    expect(u.teamId).toBe("t1");
    expect(be.currentUser()?.displayName).toBe("Meera Iyer");
  });
  it("rejects a member from the wrong team or a wrong password", async () => {
    await expect(be.loginMember("t2", "t1-u2", DEMO_PLAYER_PASSWORD)).rejects.toThrow(/isn't right/);
    await expect(be.loginMember("t1", "t1-u2", "nope")).rejects.toThrow(/isn't right/);
  });
});

describe("flags", () => {
  it("accepts the right flag once, case-insensitively, and never stores it", async () => {
    await asAdmin();
    await be.saveChallenge(null, input("Secret", "ECO{Super-Secret}", 150), new Date(Date.now() - 1000).toISOString());
    const id = be.db().challenges.find((c) => c.title === "Secret")!.id;
    be.logout();
    await be.loginMember("t4", "t4-u1", DEMO_PLAYER_PASSWORD);
    expect((await be.submitFlag(id, "ECO{1}")).correct).toBe(false);
    expect(await be.submitFlag(id, "  eco{super-secret} ")).toMatchObject({ correct: true, points: 150 });
    expect((await be.submitFlag(id, "ECO{super-secret}")).alreadySolved).toBe(true);
    expect(JSON.stringify(be.db()).toLowerCase()).not.toContain("super-secret");
  });
  it("blocks submissions to unreleased challenges and after time is up", async () => {
    await be.loginMember("t4", "t4-u1", DEMO_PLAYER_PASSWORD);
    expect((await be.submitFlag("c6", "ECO{x}")).message).toMatch(/isn't available/);
    be.logout(); await asAdmin(); await be.endEventNow(); be.logout();
    await be.loginMember("t4", "t4-u1", DEMO_PLAYER_PASSWORD);
    expect((await be.submitFlag("c7", "ECO{x}")).message).toMatch(/Time's up/);
  });
  it("rate-limits rapid guessing", async () => {
    await be.loginMember("t4", "t4-u2", DEMO_PLAYER_PASSWORD);
    for (let i = 0; i < 10; i++) await be.submitFlag("c7", `ECO{${i}}`);
    expect((await be.submitFlag("c7", "ECO{x}")).message).toMatch(/Too many/);
  }, 30_000);
  it("players cannot use admin actions", async () => {
    await be.loginMember("t1", "t1-u1", DEMO_PLAYER_PASSWORD);
    await expect(be.startTimer()).rejects.toThrow(/Only admins/);
  });
});

describe("attempts and hints", () => {
  const live = () => new Date(Date.now() - 1000).toISOString();
  async function limited(max: number) {
    await asAdmin();
    await be.saveChallenge(null, { ...input("Limited", "ECO{right}", 200), maxAttempts: max,
      hints: [{ text: "Free nudge", cost: 0 }, { text: "Big clue", cost: 50 }] }, live());
    const id = be.db().challenges.find((c) => c.title === "Limited")!.id;
    be.logout();
    return id;
  }
  it("stops a team after its wrong attempts run out, shared across members", async () => {
    const id = await limited(2);
    await be.loginMember("t4", "t4-u1", DEMO_PLAYER_PASSWORD);
    await be.submitFlag(id, "ECO{a}");
    be.logout(); await be.loginMember("t4", "t4-u2", DEMO_PLAYER_PASSWORD);
    await be.submitFlag(id, "ECO{b}");
    const r = await be.submitFlag(id, "ECO{right}");
    expect(r.correct).toBe(false);
    expect(r.message).toMatch(/used all its attempts/);
    be.logout(); await be.loginMember("t3", "t3-u1", DEMO_PLAYER_PASSWORD);
    expect((await be.submitFlag(id, "ECO{right}")).correct).toBe(true);   // other teams unaffected
  }, 30_000);
  it("lets an admin add attempts to an existing challenge", async () => {
    const id = await limited(1);
    await be.loginMember("t4", "t4-u1", DEMO_PLAYER_PASSWORD);
    await be.submitFlag(id, "ECO{a}");
    expect(attemptsLeft(be.db(), "t4", be.db().challenges.find((c) => c.id === id)!)).toBe(0);
    be.logout(); await asAdmin(); await be.addAttempts(id, 3); be.logout();
    await be.loginMember("t4", "t4-u1", DEMO_PLAYER_PASSWORD);
    expect((await be.submitFlag(id, "ECO{right}")).correct).toBe(true);
  }, 30_000);
  it("charges the team once for a hint and shows it to the whole team", async () => {
    const id = await limited(0);
    const before = scoreboard(be.db()).find((r) => r.teamId === "t4")!.score;
    await be.loginMember("t4", "t4-u1", DEMO_PLAYER_PASSWORD);
    expect((await be.unlockHint(id, 1)).text).toBe("Big clue");
    be.logout(); await be.loginMember("t4", "t4-u2", DEMO_PLAYER_PASSWORD);
    await be.unlockHint(id, 1);                                                  // already open: no second charge
    const row = scoreboard(be.db()).find((r) => r.teamId === "t4")!;
    expect(row.score).toBe(before - 50);
    expect(row.hintCost).toBe(60);                                         // includes the demo hint
    await expect(be.unlockHint(id, 9)).rejects.toThrow(/doesn't exist/);
  });
  it("upgrades data saved by the previous version", () => {
    const old = { version: 2, challenges: [{ id: "x", hint: "old hint" }, { id: "y", hint: "" }] };
    const m = migrate(old)!;
    expect(m.version).toBe(4);
    expect(m.challenges[0].hints).toEqual([{ text: "old hint", cost: 0 }]);
    expect(m.challenges[1].hints).toEqual([]);
    expect(m.hintUnlocks).toEqual([]);
  });
});

describe("grouping singles into waves", () => {
  it("groups five singles into the next wave and splits it back", async () => {
    await asAdmin();
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) ids.push((await be.saveChallenge(null, input(`S${i}`, `ECO{s${i}}`), null)).id);
    await expect(be.groupIntoWave(ids.slice(0, 4))).rejects.toThrow(/exactly 5/);
    await expect(be.groupIntoWave([...ids.slice(0, 4), "c1"])).rejects.toThrow(/already in a wave/);
    await be.groupIntoWave(ids.slice(0, 5));
    const w = be.db().waves.find((x) => x.number === 2)!;
    expect(be.db().challenges.filter((c) => c.waveId === w.id).map((c) => c.title).sort()).toEqual(["S0", "S1", "S2", "S3", "S4"]);
    expect(be.db().challenges.find((c) => c.title === "S0")!.releaseAt).toBeNull();      // still a draft
    await be.splitWave(w.id);
    expect(be.db().waves.some((x) => x.id === w.id)).toBe(false);
    expect(be.db().challenges.filter((c) => ids.includes(c.id)).every((c) => c.waveId === null)).toBe(true);
  });
});

describe("soundboard", () => {
  const mp3 = "data:audio/mpeg;base64," + btoa("ID3fake-audio-bytes");
  it("uploads a sound, uses it for a moment, and cleans up on delete", async () => {
    await asAdmin();
    const s = await be.uploadSound("bruh.mp3", mp3);
    expect(s.name).toBe("bruh");
    expect(be.soundSrc(`upload:${s.id}`)).toBe(mp3);
    await be.updateCue("lastAttempt", { sound: `upload:${s.id}`, text: "one left!", seconds: 99 });
    expect(be.db().soundboard.cues.lastAttempt).toEqual({ sound: `upload:${s.id}`, text: "one left!", seconds: 30 });
    const c = await be.saveChallenge(null, { ...input("Cue test", "ECO{x}"), cues: { wrong: { sound: `upload:${s.id}`, text: "", seconds: 3 } } }, null);
    expect(c.cues?.wrong?.sound).toBe(`upload:${s.id}`);
    await be.deleteSound(s.id);
    expect(be.db().soundboard.sounds).toHaveLength(0);
    expect(be.db().soundboard.cues.lastAttempt.sound).toBe("builtin:abhi-maza");          // back to the default
    expect(be.db().challenges.find((x) => x.id === c.id)!.cues?.wrong).toBeUndefined();
    expect(be.soundSrc(`upload:${s.id}`)).toBeNull();
  });
  it("refuses non-audio, oversized and unknown sounds", async () => {
    await asAdmin();
    await expect(be.uploadSound("x", "data:text/html;base64,PGgxPg==")).rejects.toThrow(/isn't an audio file/);
    await expect(be.uploadSound("x", "data:audio/mpeg;base64," + "A".repeat(900_000))).rejects.toThrow(/limit/);
    await expect(be.updateCue("wrong", { sound: "upload:nope", text: "", seconds: 3 })).rejects.toThrow(/isn't on the soundboard/);
    be.logout(); await be.loginMember("t1", "t1-u1", DEMO_PLAYER_PASSWORD);
    await expect(be.uploadSound("x", mp3)).rejects.toThrow(/Only admins/);
  });
  it("gives older saved data the default soundboard", () => {
    const m = migrate({ version: 3, challenges: [], hintUnlocks: [] })!;
    expect(m.version).toBe(4);
    expect(m.soundboard.cues.outOfAttempts.sound).toBe("builtin:game-over");
  });
});

describe("admin", () => {
  beforeEach(asAdmin);
  it("posts a wave of exactly five challenges with the next wave number", async () => {
    await expect(be.postWave([input("a", "ECO{a}")], null)).rejects.toThrow(/exactly 5/);
    const five = ["a", "b", "c", "d", "e"].map((x) => input(x, `ECO{${x}}`));
    const posted = await be.postWave(five, null);
    expect(posted).toHaveLength(5);
    expect(be.db().waves.find((w) => w.id === posted[0].waveId)!.number).toBe(2);
    expect(posted.every((c) => c.releaseAt === null)).toBe(true);
  }, 30_000);
  it("names the bad challenge when a wave is incomplete", async () => {
    const five = ["a", "b", "", "d", "e"].map((x) => input(x, `ECO{${x}}`));
    await expect(be.postWave(five, null)).rejects.toThrow(/Challenge 3/);
  });
  it("posts a single challenge as a draft and releases it later", async () => {
    const c = await be.saveChallenge(null, input("Solo", "ECO{solo}"), null);
    expect(c.waveId).toBeNull();
    expect(releaseStatus(c)).toBe("draft");
    await be.setRelease(c.id, new Date().toISOString());
    expect(releaseStatus(be.db().challenges.find((x) => x.id === c.id)!)).toBe("live");
  });
  it("parses a CSV of challenges for review and reports bad rows", () => {
    const csv = 'title,type,theme,points,flag,description,files\n"Bin Day",osint,plastics,120,ECO{a},"Find it, fast",map|https://x/y.png\nNo type,unknown,water,10,ECO{b},,\nBad pts,Python,food,zero,ECO{c},,';
    const r = be.parseChallengeFile(csv);
    expect(r.items).toHaveLength(1);
    expect(r.errors).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ title: "Bin Day", theme: "plastics", points: 120, files: [{ name: "map", url: "https://x/y.png" }] });
  });
  it("runs a three-hour timer", async () => {
    await be.resetTimer();
    await be.startTimer();
    const s = be.db().settings;
    expect(Date.parse(s.endsAt!) - Date.parse(s.startsAt!)).toBe(180 * 60_000);
    await be.extendTimer(10);
    expect(Date.parse(be.db().settings.endsAt!) - Date.parse(s.startsAt!)).toBe(190 * 60_000);
  });
  it("registers a team of three with working member logins and enforces team size", async () => {
    const creds = await be.createTeam("Plankton Partners", ["A One", "B Two", "C Three"]);
    expect(creds).toHaveLength(3);
    await expect(be.createTeam("Too Big", ["a", "b", "c", "d"])).rejects.toThrow(/up to 3/);
    const team = be.db().teams.find((t) => t.name === "Plankton Partners")!;
    const member = be.db().users.find((u) => u.teamId === team.id && u.displayName === "B Two")!;
    be.logout();
    expect((await be.loginMember(team.id, member.id, creds[1].password)).mustChangePassword).toBe(true);
  }, 30_000);
  it("posts notifications newest first", async () => {
    await be.postNotification("Wave 2 is live", "Five new challenges.", "important");
    expect(be.db().notifications[0]).toMatchObject({ title: "Wave 2 is live", level: "important" });
  });
  it("refuses a backup with no admin", async () => {
    const d = JSON.parse(await be.exportJSON());
    d.users = d.users.filter((u: { role: string }) => u.role !== "admin");
    await expect(be.importJSON(JSON.stringify(d))).rejects.toThrow(/locked out/);
  });
});

describe("storage", () => {
  it("saves only ciphertext when a cipher is used", async () => {
    const s = new MemStorage();
    const fake: Cipher = { seal: async (p) => "ec1:" + btoa(encodeURIComponent(p)), open: async (x) => decodeURIComponent(atob(x.slice(4))) };
    const b = new LocalBackend(s, fake);
    await b.ready(); await b.flushed();
    const raw = s.getItem("ecocypher:data")!;
    expect(raw.startsWith("ec1:")).toBe(true);
    expect(raw).not.toContain("Kelp Capital");
    const again = new LocalBackend(s, fake);
    await again.ready();
    expect(again.db().teams).toHaveLength(4);
  });
});

describe("csv", () => {
  it("handles quotes and commas", () => {
    expect(parseCSV('a,"b, c","d ""q"""\n1,2,3')).toEqual([["a", "b, c", 'd "q"'], ["1", "2", "3"]]);
  });
});
