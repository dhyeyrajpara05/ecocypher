/**
 * What each person is allowed to see. The server sends this filtered copy instead of the real data.
 *
 * - Nobody ever receives password hashes, password salts, flag hashes or flag salts: the fields are
 *   removed, not just blanked.
 * - Anonymous visitors get only what the home page, login page and scoreboard need: team names,
 *   member display names, challenge points (no titles, text, files or hints), and solve times.
 * - Players additionally get the live challenges, their own team's history and the hint text their
 *   team has opened. Other teams' wrong guesses, typed values and record ids are never sent.
 * - Admins get everything except the secrets above.
 */
import { eventStatus, releaseStatus, unlockedHints } from "./scoring";
import type { Challenge, DB, Submission, User } from "./types";

type Loose = Record<string, unknown>;
const omit = <T extends object>(o: T, keys: string[]): T => {
  const c = { ...(o as Loose) };
  for (const k of keys) delete c[k];
  return c as T;
};
const SECRET_USER = ["passwordHash", "passwordSalt"];
const SECRET_CHALLENGE = ["flagHash", "flagSalt"];

/** The minimum about another person: enough to log in as them (with their password) and to show points. */
const publicUser = (u: User): User => ({ id: u.id, displayName: u.displayName, role: u.role, teamId: u.teamId } as User);

/** A live challenge for someone who isn't logged in: points only, for the scoreboard. */
const stubChallenge = (c: Challenge): Challenge =>
  ({ id: c.id, waveId: c.waveId, typeId: c.typeId, theme: c.theme, points: c.points, releaseAt: c.releaseAt,
     title: "", description: "", files: [], hints: [], maxAttempts: 0, hidden: false, caseSensitive: false } as unknown as Challenge);

/** What other teams' solves look like: who, which challenge, when. Nothing typed, no record id. */
const publicSolve = (s: Submission): Submission => ({ teamId: s.teamId, userId: s.userId, challengeId: s.challengeId, correct: true, at: s.at } as Submission);

export function publicView(db: DB, me: User | null, now = new Date()): DB {
  const v: DB = structuredClone(db);

  // The testing-page password is never sent; the admin only learns whether one is set.
  delete v.tester;
  if (me?.role === "admin") {
    v.users = v.users.map((u) => omit(u, SECRET_USER));
    v.challenges = v.challenges.map((c) => omit(c, SECRET_CHALLENGE));
    v.testerEnabled = !!db.tester;
    return v;
  }

  const team = me?.teamId ?? null;
  const t = now.getTime();
  const frozen = db.settings.freezeAt && Date.parse(db.settings.freezeAt) <= t ? Date.parse(db.settings.freezeAt) : null;
  const othersVisible = (teamId: string, at: string) =>
    teamId === team || (db.settings.scoreboardVisible && (frozen === null || Date.parse(at) <= frozen));

  v.users = db.users.filter((u) => u.role === "player" || u.id === me?.id)
    .map((u) => (u.id === me?.id ? omit(u, SECRET_USER) : publicUser(u)));

  // Before the event clock starts, players and visitors see no challenges at all (not even titles).
  const started = eventStatus(db, now) !== "not-started";
  const live = started ? db.challenges.filter((c) => !c.hidden && releaseStatus(c, now) === "live") : [];
  v.challenges = me
    ? live.map((c) => {
        const open = team ? unlockedHints(db, team, c.id) : new Set<number>();
        return { ...omit(c, SECRET_CHALLENGE), hints: c.hints.map((h, i) => ({ cost: h.cost, text: open.has(i) ? h.text : "" })) };
      })
    : live.map(stubChallenge);
  const liveIds = new Set(live.map((c) => c.id));

  v.submissions = db.submissions
    .filter((s) => liveIds.has(s.challengeId) && othersVisible(s.teamId, s.at) && (s.correct || (team !== null && s.teamId === team)))
    .map((s) => (team !== null && s.teamId === team ? { ...s } : publicSolve(s)));
  const archived = new Set(db.challenges.filter((c) => c.archivedAt).map((c) => c.id));
  v.hintUnlocks = db.hintUnlocks
    .filter((h) => !archived.has(h.challengeId) && othersVisible(h.teamId, h.at))
    .map((h) => (team !== null && h.teamId === team ? { ...h } : ({ teamId: h.teamId, challengeId: h.challengeId, index: h.index, cost: h.cost, at: h.at } as typeof h)));
  // Waves are only labels; hide waves that have nothing live yet so their existence doesn't leak.
  const liveWaves = new Set(live.map((c) => c.waveId).filter(Boolean));
  v.waves = db.waves.filter((w) => liveWaves.has(w.id));
  return v;
}

/** Times when a player's view changes on its own (a scheduled release or the scoreboard freeze). */
export function viewChangeTimes(db: DB): string[] {
  const out = db.challenges.map((c) => c.releaseAt).filter((r): r is string => !!r);
  if (db.settings.freezeAt) out.push(db.settings.freezeAt);
  return out;
}
