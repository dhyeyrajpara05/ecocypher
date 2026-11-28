// Pure scoring and status logic. No storage, so it can be unit-tested and reused on a server later.
import type { Challenge, DB, FinalRow, Finals, ReleaseStatus, ScoreRow, Submission } from "./types";

export function releaseStatus(c: Challenge, now: Date = new Date()): ReleaseStatus {
  if (c.archivedAt) return "archived";
  if (!c.releaseAt) return "draft";
  return Date.parse(c.releaseAt) > now.getTime() ? "scheduled" : "live";
}

/** Challenges a player can see: released and not hidden. Drafts and scheduled ones are never shown. */
/** Challenges players can see: released, not hidden, and only once the event clock has started. */
export function visibleChallenges(db: DB, now: Date = new Date()): Challenge[] {
  if (eventStatus(db, now) === "not-started") return [];
  return db.challenges.filter((c) => !c.hidden && releaseStatus(c, now) === "live");
}

export type EventStatus = "not-started" | "live" | "ended";
/** "3-hour clock", "90-minute clock" or "event clock" (no time limit), for labels. */
export function clockName(minutes: number): string {
  if (!minutes) return "event clock";
  return minutes % 60 === 0 ? `${minutes / 60}-hour clock` : `${minutes}-minute clock`;
}

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

/** Wrong guesses a team has made on a challenge. */
export function wrongAttempts(db: DB, teamId: string, challengeId: string): number {
  return db.submissions.filter((s) => s.teamId === teamId && s.challengeId === challengeId && !s.correct).length;
}

/** Attempts left for a team, or Infinity when the challenge has no limit. */
export function attemptsLeft(db: DB, teamId: string, c: Challenge): number {
  return c.maxAttempts > 0 ? Math.max(0, c.maxAttempts - wrongAttempts(db, teamId, c.id)) : Infinity;
}

export function unlockedHints(db: DB, teamId: string, challengeId: string): Set<number> {
  return new Set(db.hintUnlocks.filter((h) => h.teamId === teamId && h.challengeId === challengeId).map((h) => h.index));
}

/**
 * Team scoreboard.
 *  - Each challenge is worth its own points, awarded once per team, credited to the member who solved it.
 *  - Ranking: higher score first; on equal score the team that reached that score EARLIER ranks higher.
 *  - Teams with no solves rank last, by name.
 */
export function scoreboard(db: DB, opts: { until?: Date } = {}): ScoreRow[] {
  // Archived challenges are out of play: their solves and hint costs no longer count.
  const pts = new Map(db.challenges.filter((c) => !c.archivedAt).map((c) => [c.id, c.points]));
  const archived = new Set(db.challenges.filter((c) => c.archivedAt).map((c) => c.id));
  const userName = new Map(db.users.map((u) => [u.id, u.displayName]));
  const rows = new Map<string, ScoreRow>();
  for (const t of db.teams) {
    const members = db.users.filter((u) => u.teamId === t.id && u.role === "player")
      .map((u) => ({ userId: u.id, name: u.displayName, points: 0, solves: 0 }));
    rows.set(t.id, { rank: 0, teamId: t.id, teamName: t.name, score: 0, solves: 0, hintCost: 0, lastSolveAt: null, members, history: [] });
  }
  // Solves add points; opened hints take points away from the team. Both move the "reached this score" time.
  const cutoff = opts.until ? opts.until.getTime() : Infinity;
  const events = [
    ...solves(db, opts.until).map((s) => ({ kind: "solve" as const, at: s.at, teamId: s.teamId, userId: s.userId, delta: pts.get(s.challengeId) })),
    ...(db.hintUnlocks ?? []).filter((h) => Date.parse(h.at) <= cutoff && h.cost > 0 && !archived.has(h.challengeId)).map((h) => ({ kind: "hint" as const, at: h.at, teamId: h.teamId, userId: h.userId, delta: -h.cost })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const e of events) {
    const row = rows.get(e.teamId);
    if (!row || e.delta === undefined) continue;
    row.score += e.delta;
    row.lastSolveAt = e.at;
    row.history.push({ at: e.at, score: row.score });
    if (e.kind === "hint") { row.hintCost -= e.delta; continue; }
    row.solves += 1;
    let m = row.members.find((x) => x.userId === e.userId);
    if (!m) {
      m = { userId: e.userId, name: userName.get(e.userId) ?? "Former member", points: 0, solves: 0 };
      row.members.push(m);
    }
    m.points += e.delta;
    m.solves += 1;
  }
  const list = [...rows.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (!a.solves !== !b.solves) return a.solves ? -1 : 1;
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

export function defaultFinals(): Finals {
  return { ctfWeight: 50, pitchMax: 10, judges: [], scores: {}, published: false, publishedAt: null, snapshot: null };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Final standings = CTF points + the judges' average pitch score.
 *  - CTF: the team's points exactly as on the scoreboard (after hint costs).
 *  - Pitch: the average of the judges who scored the team (0 if none did).
 *  - Ties: higher combined, then higher CTF points, then higher pitch, then team name.
 */
export function finalStandings(db: DB, f: Finals = db.finals ?? defaultFinals()): FinalRow[] {
  const ctf = scoreboard(db);
  const rows = ctf.map((r) => {
    const given = f.judges.map((j) => f.scores[r.teamId]?.[j.id]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const pitchAvg = given.length ? given.reduce((a, b) => a + b, 0) / given.length : null;
    const avg = pitchAvg === null ? null : round1(pitchAvg);
    return {
      rank: 0, teamId: r.teamId, teamName: r.teamName, members: r.members.map((m) => m.name),
      ctfScore: r.score, pitchAvg: avg, combined: round1(r.score + (avg ?? 0)),
    };
  });
  rows.sort((a, b) => b.combined - a.combined || b.ctfScore - a.ctfScore || (b.pitchAvg ?? -1) - (a.pitchAvg ?? -1) || a.teamName.localeCompare(b.teamName));
  // Teams with exactly the same combined, CTF and pitch share a rank.
  rows.forEach((r, i) => {
    const p = rows[i - 1];
    r.rank = p && p.combined === r.combined && p.ctfScore === r.ctfScore && p.pitchAvg === r.pitchAvg ? p.rank : i + 1;
  });
  return rows;
}
