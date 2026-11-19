/**
 * Backend for EcoCypher.
 *
 * LocalBackend keeps everything in the browser's localStorage. That makes the GitHub Pages
 * build fully interactive with no server, but each browser has its OWN copy of the data and
 * a determined player could read or edit it. Use it for demos and dry runs only.
 *
 * For the real event (Vercel), implement the same `Backend` interface with server API calls
 * (see docs/VERCEL.md). The UI only talks to this interface, so nothing else needs to change.
 */
import { hashFlag, hashPassword, randomId, randomSalt, tempPassword } from "./crypto";
import { demoDB, freshDB, makeChallenge, makeUser } from "./seed";
import { eventStatus, roundStatus, solves } from "./scoring";
import type { Challenge, ChallengeType, DB, Round, Settings, SubmitResult, Team, User } from "./types";

export interface Credential { team: string; displayName: string; username: string; password: string }
export interface ChallengeInput {
  roundId: string; typeId: string; title: string; description: string; points: number;
  flag?: string; caseSensitive: boolean; files: { name: string; url: string }[]; hint: string; hidden: boolean;
}
export interface ImportReport { added: number; errors: string[] }

export interface Backend {
  ready(): Promise<void>;
  db(): DB;
  subscribe(fn: () => void): () => void;
  currentUser(): User | null;
  login(username: string, password: string): Promise<User>;
  logout(): void;
  changePassword(current: string, next: string): Promise<void>;
  submitFlag(challengeId: string, value: string): Promise<SubmitResult>;
  // admin
  updateSettings(patch: Partial<Settings>): void;
  updateType(id: string, patch: Partial<ChallengeType>): void;
  createRound(name: string): Round;
  updateRound(id: string, patch: Partial<Round>): void;
  deleteRound(id: string): void;
  saveChallenge(id: string | null, input: ChallengeInput): Promise<Challenge>;
  deleteChallenge(id: string): void;
  importChallenges(roundId: string, text: string): Promise<ImportReport>;
  createTeam(name: string, members: string[]): Promise<Credential[]>;
  importTeams(csv: string): Promise<{ credentials: Credential[]; errors: string[] }>;
  renameTeam(id: string, name: string): void;
  deleteTeam(id: string): void;
  addMember(teamId: string, displayName: string): Promise<Credential>;
  resetPassword(userId: string): Promise<Credential>;
  deleteUser(userId: string): void;
  postAnnouncement(text: string): void;
  deleteAnnouncement(id: string): void;
  exportJSON(): string;
  importJSON(text: string): void;
  startFresh(): Promise<Credential>;
  loadDemo(): Promise<void>;
}

const KEY = "ecocypher:v1";
const SESSION = "ecocypher:session";

export class BackendError extends Error {}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "team";
}

/** Minimal CSV parser: handles quoted fields with commas and doubled quotes. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

export class LocalBackend implements Backend {
  private state!: DB;
  private listeners = new Set<() => void>();
  private loading: Promise<void>;
  private storage: Storage;

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage;
    this.loading = this.load();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === KEY && e.newValue) { this.state = JSON.parse(e.newValue); this.emit(); }
        if (e.key === SESSION) this.emit();
      });
    }
  }

  private async load() {
    const raw = this.storage.getItem(KEY);
    if (raw) {
      try { this.state = JSON.parse(raw); return; } catch { /* fall through to demo */ }
    }
    this.state = await demoDB();
    this.persist();
  }

  ready() { return this.loading; }
  db() { return this.state; }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((f) => f()); }
  private persist() { this.storage.setItem(KEY, JSON.stringify(this.state)); }
  private commit(mut: (d: DB) => void) {
    const next = structuredClone(this.state);
    mut(next);
    this.state = next;
    this.persist();
    this.emit();
  }

  currentUser(): User | null {
    const id = this.storage.getItem(SESSION);
    return this.state?.users.find((u) => u.id === id) ?? null;
  }
  private requireUser(): User {
    const u = this.currentUser();
    if (!u) throw new BackendError("Log in first.");
    return u;
  }
  private requireAdmin(): User {
    const u = this.requireUser();
    if (u.role !== "admin") throw new BackendError("Only admins can do that.");
    return u;
  }

  async login(username: string, password: string) {
    const u = this.state.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
    if (!u || (await hashPassword(password, u.passwordSalt)) !== u.passwordHash) {
      throw new BackendError("That username and password don't match. Check your team sheet.");
    }
    this.storage.setItem(SESSION, u.id);
    this.emit();
    return u;
  }
  logout() { this.storage.removeItem(SESSION); this.emit(); }

  async changePassword(current: string, next: string) {
    const u = this.requireUser();
    if ((await hashPassword(current, u.passwordSalt)) !== u.passwordHash) throw new BackendError("Your current password is not right.");
    if (next.length < 8) throw new BackendError("Use at least 8 characters.");
    const salt = randomSalt();
    const hash = await hashPassword(next, salt);
    this.commit((d) => { const x = d.users.find((y) => y.id === u.id)!; x.passwordSalt = salt; x.passwordHash = hash; x.mustChangePassword = false; });
  }

  async submitFlag(challengeId: string, value: string): Promise<SubmitResult> {
    const u = this.requireUser();
    if (u.role !== "player" || !u.teamId) return { ok: false, correct: false, message: "Only team members can submit flags." };
    const d = this.state;
    const ev = eventStatus(d);
    if (ev === "before") return { ok: false, correct: false, message: "The event hasn't started yet." };
    if (ev === "after") return { ok: false, correct: false, message: "The event has ended. Submissions are closed." };
    const c = d.challenges.find((x) => x.id === challengeId);
    const round = c && d.rounds.find((r) => r.id === c.roundId);
    if (!c || !round || c.hidden) return { ok: false, correct: false, message: "That challenge isn't available." };
    const rs = roundStatus(round);
    if (rs !== "open") return { ok: false, correct: false, message: rs === "closed" ? `${round.name} has closed. This challenge no longer accepts flags.` : `${round.name} hasn't opened yet.` };
    if (solves(d).some((s) => s.teamId === u.teamId && s.challengeId === c.id)) {
      return { ok: true, correct: true, alreadySolved: true, message: "Your team already solved this one." };
    }
    if (!value.trim()) return { ok: false, correct: false, message: "Type a flag first." };
    const since = Date.now() - 60_000;
    const recent = d.submissions.filter((s) => s.userId === u.id && Date.parse(s.at) > since).length;
    if (recent >= d.settings.submissionsPerMinute) return { ok: false, correct: false, message: "Too many attempts. Wait a minute and try again." };
    const correct = (await hashFlag(value, c.flagSalt, c.caseSensitive)) === c.flagHash;
    this.commit((x) => x.submissions.push({ id: randomId("s-"), userId: u.id, teamId: u.teamId!, challengeId: c.id, value: value.trim().slice(0, 200), correct, at: new Date().toISOString() }));
    return correct
      ? { ok: true, correct: true, points: c.points, message: `Deal! The sharks invested ${c.points} points in your team.` }
      : { ok: true, correct: false, message: "Not quite. That flag isn't right." };
  }

  // ---------------------------------------------------------------- admin
  updateSettings(patch: Partial<Settings>) { this.requireAdmin(); this.commit((d) => { d.settings = { ...d.settings, ...patch }; }); }
  updateType(id: string, patch: Partial<ChallengeType>) {
    this.requireAdmin();
    this.commit((d) => { const t = d.types.find((x) => x.id === id); if (t) Object.assign(t, patch, { id }); });
  }
  createRound(name: string) {
    this.requireAdmin();
    const r: Round = { id: randomId("r-"), name: name.trim() || "New round", order: (Math.max(0, ...this.state.rounds.map((x) => x.order)) + 1), state: "draft", opensAt: null, closesAt: null };
    this.commit((d) => d.rounds.push(r));
    return r;
  }
  updateRound(id: string, patch: Partial<Round>) {
    this.requireAdmin();
    this.commit((d) => { const r = d.rounds.find((x) => x.id === id); if (r) Object.assign(r, patch, { id }); });
  }
  deleteRound(id: string) {
    this.requireAdmin();
    if (this.state.challenges.some((c) => c.roundId === id)) throw new BackendError("Move or delete this round's challenges first.");
    this.commit((d) => { d.rounds = d.rounds.filter((r) => r.id !== id); });
  }

  async saveChallenge(id: string | null, input: ChallengeInput) {
    this.requireAdmin();
    if (!input.title.trim()) throw new BackendError("Give the challenge a title.");
    if (!(input.points > 0)) throw new BackendError("Points must be more than 0.");
    const existing = id ? this.state.challenges.find((c) => c.id === id) : undefined;
    if (!existing && !input.flag?.trim()) throw new BackendError("A new challenge needs a flag.");
    let flagSalt = existing?.flagSalt ?? randomSalt();
    let flagHash = existing?.flagHash ?? "";
    if (input.flag?.trim()) { flagSalt = randomSalt(); flagHash = await hashFlag(input.flag, flagSalt, input.caseSensitive); }
    else if (existing && existing.caseSensitive !== input.caseSensitive) {
      throw new BackendError("Re-enter the flag when you change case sensitivity.");
    }
    const { flag: _f, ...rest } = input;
    const c: Challenge = { id: id ?? randomId("c-"), createdAt: existing?.createdAt ?? new Date().toISOString(), ...rest, title: rest.title.trim(), flagSalt, flagHash };
    this.commit((d) => {
      const i = d.challenges.findIndex((x) => x.id === c.id);
      if (i >= 0) d.challenges[i] = c; else d.challenges.push(c);
    });
    return c;
  }
  deleteChallenge(id: string) {
    this.requireAdmin();
    this.commit((d) => { d.challenges = d.challenges.filter((c) => c.id !== id); d.submissions = d.submissions.filter((s) => s.challengeId !== id); });
  }

  /**
   * Bulk-load a wave of challenges into one round.
   * Accepts a JSON array of objects, or CSV with a header row:
   *   title,type,points,flag,description,hint,files
   * `type` matches a challenge type name (case-insensitive) or id. `files` is "name|url;name|url".
   */
  async importChallenges(roundId: string, text: string): Promise<ImportReport> {
    this.requireAdmin();
    if (!this.state.rounds.some((r) => r.id === roundId)) throw new BackendError("Pick a round to import into.");
    let items: Record<string, unknown>[] = [];
    const trimmed = text.trim();
    if (trimmed.startsWith("[")) {
      try { items = JSON.parse(trimmed); } catch { throw new BackendError("That JSON could not be read. Check for a missing comma or bracket."); }
    } else {
      const rows = parseCSV(trimmed);
      if (rows.length < 2) throw new BackendError("The CSV needs a header row and at least one challenge.");
      const head = rows[0].map((h) => h.toLowerCase());
      items = rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
    }
    const errors: string[] = [];
    let added = 0;
    for (const [i, it] of items.entries()) {
      const line = `Row ${i + 1}`;
      const typeKey = String(it.type ?? "").toLowerCase();
      const type = this.state.types.find((t) => t.id.toLowerCase() === typeKey || t.name.toLowerCase() === typeKey);
      const points = Number(it.points);
      if (!String(it.title ?? "").trim()) { errors.push(`${line}: missing title`); continue; }
      if (!type) { errors.push(`${line}: unknown type "${it.type ?? ""}"`); continue; }
      if (!(points > 0)) { errors.push(`${line}: points must be a number above 0`); continue; }
      if (!String(it.flag ?? "").trim()) { errors.push(`${line}: missing flag`); continue; }
      const files = Array.isArray(it.files) ? (it.files as { name: string; url: string }[])
        : String(it.files ?? "").split(";").map((p) => p.split("|")).filter((p) => p[0]?.trim() && p[1]?.trim()).map(([name, url]) => ({ name: name.trim(), url: url.trim() }));
      await this.saveChallenge(null, {
        roundId, typeId: type.id, title: String(it.title), description: String(it.description ?? ""), points,
        flag: String(it.flag), caseSensitive: String(it.caseSensitive ?? it.case_sensitive ?? "").toLowerCase() === "true",
        files, hint: String(it.hint ?? ""), hidden: false,
      });
      added++;
    }
    return { added, errors };
  }

  private async newMember(teamId: string, teamName: string, displayName: string, index: number): Promise<{ user: User; cred: Credential }> {
    const base = `${slug(teamName)}-${index}`;
    let username = base, n = 2;
    while (this.state.users.some((u) => u.username === username)) username = `${base}-${n++}`;
    const password = tempPassword();
    const user = await makeUser({ id: randomId("u-"), username, displayName: displayName.trim() || `${teamName} member ${index}`, role: "player", teamId, mustChangePassword: true, password });
    return { user, cred: { team: teamName, displayName: user.displayName, username, password } };
  }

  async createTeam(name: string, members: string[]) {
    this.requireAdmin();
    const teamName = name.trim();
    if (!teamName) throw new BackendError("Give the team a name.");
    if (this.state.teams.some((t) => t.name.toLowerCase() === teamName.toLowerCase())) throw new BackendError(`A team called "${teamName}" already exists.`);
    const names = members.map((m) => m.trim()).filter(Boolean);
    if (names.length === 0) throw new BackendError("Add at least one member.");
    const team: Team = { id: randomId("t-"), name: teamName, createdAt: new Date().toISOString() };
    const created: { user: User; cred: Credential }[] = [];
    for (const [i, m] of names.entries()) {
      const x = await this.newMember(team.id, teamName, m, i + 1);
      created.push(x);
      this.state.users.push(x.user); // reserve username for the next loop iteration
    }
    this.state.users = this.state.users.filter((u) => !created.some((c) => c.user.id === u.id));
    this.commit((d) => { d.teams.push(team); d.users.push(...created.map((c) => c.user)); });
    return created.map((c) => c.cred);
  }

  /** CSV: team,member1,member2,member3[,member4] (header optional). */
  async importTeams(csv: string) {
    this.requireAdmin();
    const rows = parseCSV(csv);
    const start = rows[0]?.[0]?.toLowerCase().startsWith("team") ? 1 : 0;
    const credentials: Credential[] = [];
    const errors: string[] = [];
    for (const r of rows.slice(start)) {
      try { credentials.push(...(await this.createTeam(r[0], r.slice(1)))); }
      catch (e) { errors.push(`${r[0] || "(blank)"}: ${(e as Error).message}`); }
    }
    return { credentials, errors };
  }

  renameTeam(id: string, name: string) {
    this.requireAdmin();
    if (!name.trim()) throw new BackendError("Team name can't be empty.");
    this.commit((d) => { const t = d.teams.find((x) => x.id === id); if (t) t.name = name.trim(); });
  }
  deleteTeam(id: string) {
    this.requireAdmin();
    this.commit((d) => {
      d.teams = d.teams.filter((t) => t.id !== id);
      d.users = d.users.filter((u) => u.teamId !== id);
      d.submissions = d.submissions.filter((s) => s.teamId !== id);
    });
  }
  async addMember(teamId: string, displayName: string) {
    this.requireAdmin();
    const team = this.state.teams.find((t) => t.id === teamId);
    if (!team) throw new BackendError("Team not found.");
    const count = this.state.users.filter((u) => u.teamId === teamId).length;
    const x = await this.newMember(teamId, team.name, displayName, count + 1);
    this.commit((d) => d.users.push(x.user));
    return x.cred;
  }
  async resetPassword(userId: string) {
    this.requireAdmin();
    const u = this.state.users.find((x) => x.id === userId);
    if (!u) throw new BackendError("User not found.");
    const password = tempPassword();
    const salt = randomSalt();
    const hash = await hashPassword(password, salt);
    this.commit((d) => { const x = d.users.find((y) => y.id === userId)!; x.passwordSalt = salt; x.passwordHash = hash; x.mustChangePassword = true; });
    const team = this.state.teams.find((t) => t.id === u.teamId);
    return { team: team?.name ?? "(admin)", displayName: u.displayName, username: u.username, password };
  }
  deleteUser(userId: string) {
    const me = this.requireAdmin();
    if (userId === me.id) throw new BackendError("You can't delete your own account while logged in.");
    this.commit((d) => { d.users = d.users.filter((u) => u.id !== userId); });
  }
  postAnnouncement(text: string) {
    this.requireAdmin();
    if (!text.trim()) return;
    this.commit((d) => d.announcements.unshift({ id: randomId("a-"), text: text.trim(), at: new Date().toISOString() }));
  }
  deleteAnnouncement(id: string) { this.requireAdmin(); this.commit((d) => { d.announcements = d.announcements.filter((a) => a.id !== id); }); }

  exportJSON() { this.requireAdmin(); return JSON.stringify(this.state, null, 2); }
  importJSON(text: string) {
    this.requireAdmin();
    let d: DB;
    try { d = JSON.parse(text); } catch { throw new BackendError("That file isn't a valid EcoCypher backup."); }
    if (d?.version !== 1 || !Array.isArray(d.users)) throw new BackendError("That file isn't a valid EcoCypher backup.");
    if (!d.users.some((u) => u.role === "admin")) throw new BackendError("The backup has no admin account, so you'd be locked out.");
    this.state = d; this.persist(); this.emit();
  }
  async startFresh() {
    this.requireAdmin();
    const password = tempPassword();
    const d = await freshDB({ username: "admin", password });
    this.state = d; this.persist();
    this.storage.setItem(SESSION, d.users[0].id);
    this.emit();
    return { team: "(admin)", displayName: "Event admin", username: "admin", password };
  }
  async loadDemo() {
    this.state = await demoDB(); this.persist();
    this.storage.removeItem(SESSION);
    this.emit();
  }
}
