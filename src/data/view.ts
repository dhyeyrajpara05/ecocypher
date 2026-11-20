/**
 * What each person is allowed to see. The server sends this filtered copy instead of the real data,
 * so flag hashes, password hashes, unreleased challenges and locked hints never leave the server.
 */
import { releaseStatus, unlockedHints } from "./scoring";
import type { DB, User } from "./types";

const stripUser = (u: User, keepUsername: boolean): User =>
  ({ ...u, passwordHash: "", passwordSalt: "", username: keepUsername ? u.username : "" });

export function publicView(db: DB, me: User | null, now = new Date()): DB {
  const v: DB = structuredClone(db);
  for (const c of v.challenges) { c.flagHash = ""; c.flagSalt = ""; }

  if (me?.role === "admin") {
    v.users = v.users.map((u) => stripUser(u, true));
    return v;
  }

  const team = me?.teamId ?? null;
  const t = now.getTime();
  const frozen = db.settings.freezeAt && Date.parse(db.settings.freezeAt) <= t ? Date.parse(db.settings.freezeAt) : null;
  const othersVisible = (teamId: string, at: string) =>
    teamId === team || (db.settings.scoreboardVisible && (frozen === null || Date.parse(at) <= frozen));

  v.users = v.users.filter((u) => u.role === "player" || u.id === me?.id).map((u) => stripUser(u, u.id === me?.id));
  v.challenges = v.challenges.filter((c) => !c.hidden && releaseStatus(c, now) === "live");
  for (const c of v.challenges) {
    const open = team ? unlockedHints(db, team, c.id) : new Set<number>();
    c.hints = c.hints.map((h, i) => ({ cost: h.cost, text: open.has(i) ? h.text : "" }));
  }
  const live = new Set(v.challenges.map((c) => c.id));
  v.submissions = v.submissions
    .filter((s) => live.has(s.challengeId) && (s.teamId === team || s.correct) && othersVisible(s.teamId, s.at))
    .map((s) => (s.teamId === team ? s : { ...s, value: "" }));
  v.hintUnlocks = v.hintUnlocks.filter((h) => othersVisible(h.teamId, h.at));
  return v;
}

/** Times when a player's view changes on its own (a scheduled release or the scoreboard freeze). */
export function viewChangeTimes(db: DB): string[] {
  const out = db.challenges.map((c) => c.releaseAt).filter((r): r is string => !!r);
  if (db.settings.freezeAt) out.push(db.settings.freezeAt);
  return out;
}
