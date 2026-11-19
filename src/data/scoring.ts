// Pure scoring and status logic. No storage, so it can be unit-tested and reused on a server later.
import type { Challenge, DB, ReleaseStatus, ScoreRow, Submission } from "./types";

export function releaseStatus(c: Challenge, now: Date = new Date()): ReleaseStatus {
  if (!c.releaseAt) return "draft";
  return Date.parse(c.releaseAt) > now.getTime() ? "scheduled" : "live";
}

/** Challenges a player can see: released and not hidden. Drafts and scheduled ones are never shown. */
export function visibleChallenges(db: DB, now: Date = new Date()): Challenge[] {
  return db.challenges.filter((c) => !c.hidden && releaseStatus(c, now) === "live");
}

export type EventStatus = "not-started" | "live" | "ended";
export function eventStatus(db: DB, now: Date = new Date()): EventStatus {
  const { startsAt, endsAt } = db.settings;
  if (!startsAt || now.getTime() < Date.parse(startsAt)) return "not-started";
  if (endsAt && now.getTime() >= Date.parse(endsAt)) return "ended";
  return "live";
}

/** First correct submission per (team, challenge) = the solve that scores. */
export function solves(db: DB, until?: Date): Submission[] {
  const seen = new Set<string>();
  const out: Submission[] = [];
  const cutoff = until ? until.getTime() : Infinity;
  const sorted = [...db.submissions].filter((s) => s.correct && Date.parse(s.at) <= cutoff).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const s of sorted) {
    const k = `${s.teamId}:${s.challengeId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/**
 * Team scoreboard.
 *  - Each challenge is worth its own points, awarded once per team, credited to the member who solved it.
 *  - Ranking: higher score first; on equal score the team that reached that score EARLIER ranks higher.
 *  - Teams with no solves rank last, by name.
 */
export function scoreboard(db: DB, opts: { until?: Date } = {}): ScoreRow[] {
  const pts = new Map(db.challenges.map((c) => [c.id, c.points]));
  const userName = new Map(db.users.map((u) => [u.id, u.displayName]));
  const rows = new Map<string, ScoreRow>();
  for (const t of db.teams) {
    const members = db.users.filter((u) => u.teamId === t.id && u.role === "player")
      .map((u) => ({ userId: u.id, name: u.displayName, points: 0, solves: 0 }));
    rows.set(t.id, { rank: 0, teamId: t.id, teamName: t.name, score: 0, solves: 0, lastSolveAt: null, members, history: [] });
  }
  for (const s of solves(db, opts.until)) {
    const row = rows.get(s.teamId);
    const p = pts.get(s.challengeId);
    if (!row || p === undefined) continue;
    row.score += p;
    row.solves += 1;
    row.lastSolveAt = s.at;
    row.history.push({ at: s.at, score: row.score });
    let m = row.members.find((x) => x.userId === s.userId);
    if (!m) {
      m = { userId: s.userId, name: userName.get(s.userId) ?? "Former member", points: 0, solves: 0 };
      row.members.push(m);
    }
    m.points += p;
    m.solves += 1;
  }
  const list = [...rows.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.lastSolveAt && b.lastSolveAt) return Date.parse(a.lastSolveAt) - Date.parse(b.lastSolveAt);
    if (a.lastSolveAt) return -1;
    if (b.lastSolveAt) return 1;
    return a.teamName.localeCompare(b.teamName);
  });
  list.forEach((r, i) => {
    r.rank = i + 1;
    r.members.sort((a, b) => b.points - a.points);
  });
  return list;
}

export function solveCounts(db: DB): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of solves(db)) m.set(s.challengeId, (m.get(s.challengeId) ?? 0) + 1);
  return m;
}

export const WAVE_SIZE = 5;
