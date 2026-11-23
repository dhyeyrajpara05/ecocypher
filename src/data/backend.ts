/**
 * Backend for EcoCypher.
 *
 * LocalBackend keeps everything in the browser (encrypted, see vault.ts). That makes the GitHub Pages
 * build fully interactive with no server, but each browser has its OWN copy of the data. Use it for
 * demos and dry runs. For the real event implement the same `Backend` interface against a server
 * (see docs/VERCEL.md). The UI only talks to this interface.
 */
import { hashFlag, hashPassword, randomId, randomSalt, sameHash, tempPassword } from "./crypto";
import { demoDB, emptyDB, makeUser } from "./seed";
import { attemptsLeft, eventStatus, releaseStatus, solves, unlockedHints, WAVE_SIZE } from "./scoring";
import { BUILTIN_SOUNDS, CUE_KEYS, defaultSoundboard, MAX_SOUND_BYTES } from "./sounds";
import type { Challenge, ChallengeType, Cue, CueKey, DB, Hint, NoticeLevel, Settings, SoundMeta, SubmitResult, Team, ThemeKey, User } from "./types";
import { plainCipher, type Cipher } from "./vault";

export interface Credential { team: string; displayName: string; username: string; password: string }
export interface ChallengeInput {
  typeId: string; theme: ThemeKey; title: string; description: string; points: number;
  flag?: string; caseSensitive: boolean; files: { name: string; url: string }[]; hints: Hint[]; maxAttempts: number; hidden: boolean;
  cues?: Partial<Record<CueKey, Cue>>;
  python?: { enabled: boolean; starter: string };
}
export interface ParsedFile { items: ChallengeInput[]; errors: string[] }

export interface Backend {
  ready(): Promise<void>;
  db(): DB;
  subscribe(fn: () => void): () => void;
  currentUser(): User | null;
  login(username: string, password: string): Promise<User>;
  loginMember(teamId: string, userId: string, password: string): Promise<User>;
  logout(): void;
  changePassword(current: string, next: string): Promise<void>;
  submitFlag(challengeId: string, value: string): Promise<SubmitResult>;
  unlockHint(challengeId: string, index: number): Promise<Hint>;
  // admin: event
  updateSettings(patch: Partial<Settings>): Promise<void>;
  startTimer(): Promise<void>;
  extendTimer(minutes: number): Promise<void>;
  endEventNow(): Promise<void>;
  resetTimer(): Promise<void>;
  updateType(id: string, patch: Partial<ChallengeType>): Promise<void>;
  // admin: challenges
  postWave(items: ChallengeInput[], releaseAt: string | null): Promise<Challenge[]>;
  saveChallenge(id: string | null, input: ChallengeInput, releaseAt?: string | null): Promise<Challenge>;
  setRelease(id: string, releaseAt: string | null): Promise<void>;
  groupIntoWave(ids: string[]): Promise<void>;
  splitWave(waveId: string): Promise<void>;
  addAttempts(id: string, extra: number): Promise<void>;
  deleteChallenge(id: string): Promise<void>;
  parseChallengeFile(text: string): ParsedFile;
  // admin: people
  createTeam(name: string, members: string[]): Promise<Credential[]>;
  importTeams(csv: string): Promise<{ credentials: Credential[]; errors: string[] }>;
  renameTeam(id: string, name: string): Promise<void>;
  deleteTeam(id: string): Promise<void>;
  addMember(teamId: string, displayName: string): Promise<Credential>;
  resetPassword(userId: string): Promise<Credential>;
  deleteUser(userId: string): Promise<void>;
  // admin: notifications and data
  postNotification(title: string, body: string, level: NoticeLevel): Promise<void>;
  // admin: soundboard
  updateCue(key: CueKey, cue: Cue): Promise<void>;
  uploadSound(name: string, dataUrl: string): Promise<SoundMeta>;
  deleteSound(id: string): Promise<void>;
  /** A URL the browser can play for a sound reference ("builtin:…" or "upload:…"), or null. */
  soundSrc(ref: string): string | null;
  deleteNotification(id: string): Promise<void>;
  exportJSON(): Promise<string>;
  importJSON(text: string): Promise<void>;
  /** Clears the event but keeps the admin who pressed it (same password), the settings, types and soundboard. */
  startFresh(): Promise<void>;
  loadDemo(): Promise<void>;
}

export const KEY = "ecocypher:data";
export const SESSION = "ecocypher:session";
export const THEMES: ThemeKey[] = ["plastics", "energy", "water", "ewaste", "food", "climate"];

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

/** Upgrades data saved by older versions of the site. Returns null if it can't be read. */
export function migrate(d: any): DB | null {
  if (d?.version === 2) {
    for (const c of d.challenges ?? []) {
      c.hints = c.hint ? [{ text: c.hint, cost: 0 }] : [];
      c.maxAttempts = 0;
      delete c.hint;
    }
    d.hintUnlocks = [];
    d.version = 3;
  }
  if (d?.version === 3) {
    d.soundboard = defaultSoundboard();
    d.version = 4;
  }
  return d?.version === 4 ? (d as DB) : null;
}

/** Reads challenges from CSV or a JSON array, for review in the form before posting. */
export function parseChallengeText(text: string, types: ChallengeType[]): ParsedFile {
  let rows: Record<string, unknown>[] = [];
  const t = text.trim();
  if (t.startsWith("[")) {
    try { rows = JSON.parse(t); } catch { throw new BackendError("That JSON could not be read. Check for a missing comma or bracket."); }
  } else {
    const csv = parseCSV(t);
    if (csv.length < 2) throw new BackendError("The CSV needs a header row and at least one challenge.");
    const head = csv[0].map((h) => h.toLowerCase());
    rows = csv.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
  }
  const items: ChallengeInput[] = [];
  const errors: string[] = [];
  rows.forEach((it, i) => {
    const n = `Row ${i + 1}`;
    const key = String(it.type ?? "").toLowerCase();
    const type = types.find((x) => x.id.toLowerCase() === key || x.name.toLowerCase() === key);
    const theme = String(it.theme ?? "plastics").toLowerCase().replace(/[^a-z]/g, "") as ThemeKey;
    const points = Number(it.points);
    if (!String(it.title ?? "").trim()) return errors.push(`${n}: missing title`);
    if (!type) return errors.push(`${n}: unknown type "${it.type ?? ""}"`);
    if (!(points > 0)) return errors.push(`${n}: points must be a number above 0`);
    if (!String(it.flag ?? "").trim()) return errors.push(`${n}: missing flag`);
    const files = Array.isArray(it.files) ? (it.files as { name: string; url: string }[])
      : String(it.files ?? "").split(";").map((p) => p.split("|")).filter((p) => p[0]?.trim() && p[1]?.trim()).map(([name, url]) => ({ name: name.trim(), url: url.trim() }));
    items.push({ typeId: type.id, theme: THEMES.includes(theme) ? theme : "plastics", title: String(it.title).trim(), description: String(it.description ?? ""),
      points, flag: String(it.flag).trim(), caseSensitive: String(it.caseSensitive ?? it.case_sensitive ?? "").toLowerCase() === "true",
      files, hidden: false, maxAttempts: Math.max(0, Math.round(Number(it.attempts ?? it.max_attempts ?? 0)) || 0),
      hints: Array.isArray(it.hints) ? (it.hints as Hint[]) : String(it.hint ?? "").trim() ? [{ text: String(it.hint).trim(), cost: Math.max(0, Number(it.hint_cost ?? it.hintCost ?? 0) || 0) }] : [] });
  });
  return { items, errors };
}

const baseUrl = () => { try { return import.meta.env.BASE_URL ?? "/"; } catch { return "/"; } };

/** Validates an uploaded sound and returns its details. Shared by the browser and the server. */
export function soundMetaFor(name: string, dataUrl: string): SoundMeta {
  const m = /^data:(audio\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new BackendError("That file isn't an audio file. Use an MP3, WAV, OGG or M4A.");
  const bytes = Math.floor((m[2].length * 3) / 4) - (m[2].endsWith("==") ? 2 : m[2].endsWith("=") ? 1 : 0);
  if (bytes > MAX_SOUND_BYTES) throw new BackendError(`That sound is ${Math.round(bytes / 1024)} KB. The limit is ${MAX_SOUND_BYTES / 1024} KB; trim it to a few seconds.`);
  const clean = name.replace(/\.[a-z0-9]+$/i, "").trim().slice(0, 60) || "Sound";
  return { id: randomId("snd-"), name: clean, bytes, mime: m[1], addedAt: new Date().toISOString() };
}

function checkCue(cue: Cue, sounds: SoundMeta[]): Cue {
  const sound = String(cue?.sound ?? "none");
  const ok = sound === "none" || BUILTIN_SOUNDS.some((b) => b.ref === sound) || (sound.startsWith("upload:") && sounds.some((s) => `upload:${s.id}` === sound));
  if (!ok) throw new BackendError("That sound isn't on the soundboard any more.");
  const seconds = Math.min(30, Math.max(1, Math.round(Number(cue.seconds) || 4)));
  return { sound, text: String(cue.text ?? "").trim().slice(0, 40), seconds };
}

function cleanCues(cues: ChallengeInput["cues"]): Challenge["cues"] {
  if (!cues) return undefined;
  const out: NonNullable<Challenge["cues"]> = {};
  for (const k of CUE_KEYS) { const c = cues[k]; if (c) out[k] = { sound: String(c.sound), text: String(c.text ?? "").trim().slice(0, 40), seconds: Math.min(30, Math.max(1, Math.round(Number(c.seconds) || 4))) }; }
  return Object.keys(out).length ? out : undefined;
}

export class LocalBackend implements Backend {
  private state!: DB;
  private listeners = new Set<() => void>();
  private loading: Promise<void>;
  private writing: Promise<void> = Promise.resolve();
  private cipher!: Cipher;

  constructor(private storage: Storage = window.localStorage, cipher: Cipher | Promise<Cipher> = plainCipher) {
    this.loading = this.load(cipher);
  }

  private async load(cipherP: Cipher | Promise<Cipher>) {
    this.cipher = await cipherP;
    const raw = this.storage.getItem(KEY);
    if (raw) {
      try {
        const d = migrate(JSON.parse(await this.cipher.open(raw)));
        if (d) { this.state = d; this.persist(); this.listen(); return; }
      } catch { /* unreadable (e.g. key cleared): start over with demo data */ }
    }
    this.storage.removeItem("ecocypher:v1"); // data from the first version
    this.state = await demoDB();
    this.persist();
    this.listen();
  }

  private listen() {
    if (typeof window === "undefined") return;
    window.addEventListener("storage", async (e) => {
      if (e.key === KEY && e.newValue) {
        try { this.state = JSON.parse(await this.cipher.open(e.newValue)); this.emit(); } catch { /* ignore */ }
      }
      if (e.key === SESSION) this.emit();
    });
  }

  ready() { return this.loading; }
  /** Resolves when the latest change has been encrypted and saved. */
  flushed() { return this.writing; }
  db() { return this.state; }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((f) => f()); }
  private persist() {
    const snapshot = JSON.stringify(this.state);
    this.writing = this.writing.then(async () => this.storage.setItem(KEY, await this.cipher.seal(snapshot)));
  }
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

  private async checkPassword(u: User | undefined, password: string, msg: string) {
    if (!u || !sameHash(await hashPassword(password, u.passwordSalt), u.passwordHash)) throw new BackendError(msg);
    this.storage.setItem(SESSION, u.id);
    this.emit();
    return u;
  }
  login(username: string, password: string) {
    const u = this.state.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
    return this.checkPassword(u, password, "That username and password don't match.");
  }
  loginMember(teamId: string, userId: string, password: string) {
    const u = this.state.users.find((x) => x.id === userId && x.teamId === teamId && x.role === "player");
    return this.checkPassword(u, password, "That password isn't right for this member. Check your team sheet.");
  }
  logout() { this.storage.removeItem(SESSION); this.emit(); }

  async changePassword(current: string, next: string) {
    const u = this.requireUser();
    if (!sameHash(await hashPassword(current, u.passwordSalt), u.passwordHash)) throw new BackendError("Your current password is not right.");
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
    if (ev === "not-started") return { ok: false, correct: false, message: "The timer hasn't started yet." };
    if (ev === "ended") return { ok: false, correct: false, message: "Time's up. Submissions are closed." };
    const c = d.challenges.find((x) => x.id === challengeId);
    if (!c || c.hidden || releaseStatus(c) !== "live") return { ok: false, correct: false, message: "That challenge isn't available." };
    if (solves(d).some((s) => s.teamId === u.teamId && s.challengeId === c.id)) {
      return { ok: true, correct: true, alreadySolved: true, message: "Your team already solved this one." };
    }
    if (!value.trim()) return { ok: false, correct: false, message: "Type a flag first." };
    if (attemptsLeft(d, u.teamId, c) <= 0) return { ok: false, correct: false, message: "Your team has used all its attempts on this challenge. Ask an organiser if you think that's unfair." };
    const since = Date.now() - 60_000;
    if (d.submissions.filter((s) => s.userId === u.id && Date.parse(s.at) > since).length >= d.settings.submissionsPerMinute) {
      return { ok: false, correct: false, message: "Too many attempts. Wait a minute and try again." };
    }
    const correct = sameHash(await hashFlag(value, c.flagSalt, c.caseSensitive), c.flagHash);
    // Wrong guesses are kept for the review log; correct flags are never stored as typed.
    this.commit((x) => x.submissions.push({ id: randomId("s-"), userId: u.id, teamId: u.teamId!, challengeId: c.id, value: correct ? "(correct flag)" : value.trim().slice(0, 200), correct, at: new Date().toISOString() }));
    return correct
      ? { ok: true, correct: true, points: c.points, message: `Deal! The sharks invested ${c.points} points in your team.` }
      : { ok: true, correct: false, message: "Not quite. That flag isn't right." };
  }

  /** Opens a hint for the whole team. Its cost comes off the team's score straight away. */
  async unlockHint(challengeId: string, index: number): Promise<Hint> {
    const u = this.requireUser();
    if (u.role !== "player" || !u.teamId) throw new BackendError("Only team members can open hints.");
    const c = this.state.challenges.find((x) => x.id === challengeId);
    if (!c || c.hidden || releaseStatus(c) !== "live") throw new BackendError("That challenge isn't available.");
    const hint = c.hints[index];
    if (!hint) throw new BackendError("That hint doesn't exist.");
    if (unlockedHints(this.state, u.teamId, c.id).has(index)) return hint;
    if (eventStatus(this.state) !== "live") throw new BackendError("Hints open while the clock is running.");
    this.commit((d) => d.hintUnlocks.push({ id: randomId("h-"), teamId: u.teamId!, userId: u.id, challengeId: c.id, index, cost: hint.cost, at: new Date().toISOString() }));
    return hint;
  }

  // ---------------------------------------------------------------- admin: event
  async updateSettings(patch: Partial<Settings>) { this.requireAdmin(); this.commit((d) => { d.settings = { ...d.settings, ...patch }; }); }
  async startTimer() {
    this.requireAdmin();
    const now = Date.now();
    // durationMinutes 0 = no time limit: the event runs until an admin presses "End now".
    this.commit((d) => { d.settings.startsAt = new Date(now).toISOString(); d.settings.endsAt = d.settings.durationMinutes > 0 ? new Date(now + d.settings.durationMinutes * 60_000).toISOString() : null; });
  }
  async extendTimer(minutes: number) {
    this.requireAdmin();
    if (!this.state.settings.startsAt) throw new BackendError("Start the timer first.");
    if (!this.state.settings.endsAt) throw new BackendError("The event has no time limit, so there's nothing to extend.");
    this.commit((d) => { d.settings.endsAt = new Date(Date.parse(d.settings.endsAt!) + minutes * 60_000).toISOString(); });
  }
  async endEventNow() { this.requireAdmin(); this.commit((d) => { d.settings.endsAt = new Date().toISOString(); }); }
  async resetTimer() { this.requireAdmin(); this.commit((d) => { d.settings.startsAt = null; d.settings.endsAt = null; }); }
  async updateType(id: string, patch: Partial<ChallengeType>) {
    this.requireAdmin();
    this.commit((d) => { const t = d.types.find((x) => x.id === id); if (t) Object.assign(t, patch, { id }); });
  }

  // ---------------------------------------------------------------- admin: challenges
  private validate(input: ChallengeInput, needFlag: boolean, label = "") {
    const p = label ? `${label}: ` : "";
    if (!input.title.trim()) throw new BackendError(`${p}give the challenge a title.`);
    if (!(input.points > 0)) throw new BackendError(`${p}points must be more than 0.`);
    if (needFlag && !input.flag?.trim()) throw new BackendError(`${p}add a flag.`);
    if (!this.state.types.some((t) => t.id === input.typeId)) throw new BackendError(`${p}pick a challenge type.`);
    if (!(input.maxAttempts >= 0)) throw new BackendError(`${p}attempts must be 0 (unlimited) or more.`);
    if (input.hints.some((h) => h.text.trim() && !(h.cost >= 0))) throw new BackendError(`${p}hint costs can't be negative.`);
  }

  private async build(input: ChallengeInput, existing: Challenge | undefined, waveId: string | null, releaseAt: string | null): Promise<Challenge> {
    let flagSalt = existing?.flagSalt ?? randomSalt();
    let flagHash = existing?.flagHash ?? "";
    if (input.flag?.trim()) { flagSalt = randomSalt(); flagHash = await hashFlag(input.flag, flagSalt, input.caseSensitive); }
    else if (existing && existing.caseSensitive !== input.caseSensitive) throw new BackendError("Re-enter the flag when you change case sensitivity.");
    const { flag: _omit, ...rest } = input;
    return { id: existing?.id ?? randomId("c-"), createdAt: existing?.createdAt ?? new Date().toISOString(), ...rest,
      title: rest.title.trim(), files: rest.files.filter((f) => f.name.trim() && f.url.trim()),
      hints: rest.hints.filter((h) => h.text.trim()).map((h) => ({ text: h.text.trim(), cost: Math.round(h.cost) || 0 })),
      maxAttempts: Math.round(rest.maxAttempts) || 0, cues: cleanCues(rest.cues),
      python: rest.python?.enabled ? { enabled: true, starter: String(rest.python.starter ?? "").slice(0, 20_000) } : undefined,
      waveId, releaseAt, flagSalt, flagHash };
  }

  /** Posts exactly five challenges together as the next wave. */
  async postWave(items: ChallengeInput[], releaseAt: string | null) {
    this.requireAdmin();
    if (items.length !== WAVE_SIZE) throw new BackendError(`A wave has exactly ${WAVE_SIZE} challenges. You have ${items.length}.`);
    items.forEach((it, i) => this.validate(it, true, `Challenge ${i + 1}`));
    const wave = { id: randomId("w-"), number: Math.max(0, ...this.state.waves.map((w) => w.number)) + 1, createdAt: new Date().toISOString() };
    const built = await Promise.all(items.map((it) => this.build(it, undefined, wave.id, releaseAt)));
    this.commit((d) => { d.waves.push(wave); d.challenges.push(...built); });
    return built;
  }

  /** Puts exactly five single challenges into a new wave. Each keeps its own release status. */
  async groupIntoWave(ids: string[]) {
    this.requireAdmin();
    const unique = [...new Set(ids)];
    if (unique.length !== WAVE_SIZE) throw new BackendError(`Pick exactly ${WAVE_SIZE} challenges for a wave. You picked ${unique.length}.`);
    const picked = unique.map((id) => this.state.challenges.find((c) => c.id === id));
    if (picked.some((c) => !c)) throw new BackendError("One of those challenges no longer exists.");
    const inWave = picked.find((c) => c!.waveId);
    if (inWave) throw new BackendError(`"${inWave!.title}" is already in a wave. Split that wave first.`);
    const wave = { id: randomId("w-"), number: Math.max(0, ...this.state.waves.map((w) => w.number)) + 1, createdAt: new Date().toISOString() };
    this.commit((d) => {
      d.waves.push(wave);
      for (const c of d.challenges) if (unique.includes(c.id)) c.waveId = wave.id;
    });
  }
  /** Turns a wave's challenges back into single challenges and removes the wave. */
  async splitWave(waveId: string) {
    this.requireAdmin();
    if (!this.state.waves.some((w) => w.id === waveId)) throw new BackendError("That wave no longer exists.");
    this.commit((d) => {
      for (const c of d.challenges) if (c.waveId === waveId) c.waveId = null;
      d.waves = d.waves.filter((w) => w.id !== waveId);
    });
  }

  /** Creates a single challenge (id = null) or edits any challenge, keeping its wave. */
  async saveChallenge(id: string | null, input: ChallengeInput, releaseAt?: string | null) {
    this.requireAdmin();
    const existing = id ? this.state.challenges.find((c) => c.id === id) : undefined;
    if (id && !existing) throw new BackendError("That challenge no longer exists.");
    this.validate(input, !existing);
    const c = await this.build(input, existing, existing?.waveId ?? null, releaseAt === undefined ? existing?.releaseAt ?? null : releaseAt);
    this.commit((d) => {
      const i = d.challenges.findIndex((x) => x.id === c.id);
      if (i >= 0) d.challenges[i] = c; else d.challenges.push(c);
    });
    return c;
  }
  async setRelease(id: string, releaseAt: string | null) {
    this.requireAdmin();
    this.commit((d) => { const c = d.challenges.find((x) => x.id === id); if (c) c.releaseAt = releaseAt; });
  }
  /** Gives every team more wrong guesses on a challenge. Also works if the limit was 0 (it becomes a limit). */
  async addAttempts(id: string, extra: number) {
    this.requireAdmin();
    const c = this.state.challenges.find((x) => x.id === id);
    if (!c) throw new BackendError("That challenge no longer exists.");
    if (c.maxAttempts === 0) throw new BackendError("This challenge already has unlimited attempts.");
    this.commit((d) => { const x = d.challenges.find((y) => y.id === id)!; x.maxAttempts = Math.max(1, x.maxAttempts + extra); });
  }
  // ---------------------------------------------------------------- admin: soundboard
  async updateCue(key: CueKey, cue: Cue) {
    this.requireAdmin();
    if (!CUE_KEYS.includes(key)) throw new BackendError("Unknown moment.");
    const c = checkCue(cue, this.state.soundboard.sounds);
    this.commit((d) => { d.soundboard.cues[key] = c; });
  }
  /** Browser-only version: the audio is kept in this browser's storage. The server stores it in the database instead. */
  async uploadSound(name: string, dataUrl: string) {
    this.requireAdmin();
    const meta = soundMetaFor(name, dataUrl);
    try { this.storage.setItem(`ecocypher:sound:${meta.id}`, dataUrl); }
    catch { throw new BackendError("This browser has no room left for that sound. Try a shorter clip."); }
    await this.registerSound(meta);
    return meta;
  }
  /** Records an uploaded sound's details. Called after the audio itself has been stored. */
  async registerSound(meta: SoundMeta) {
    this.requireAdmin();
    this.commit((d) => { d.soundboard.sounds.push(meta); });
  }
  async deleteSound(id: string) {
    this.requireAdmin();
    const ref = `upload:${id}`;
    this.commit((d) => {
      d.soundboard.sounds = d.soundboard.sounds.filter((s) => s.id !== id);
      for (const k of CUE_KEYS) if (d.soundboard.cues[k].sound === ref) d.soundboard.cues[k] = defaultSoundboard().cues[k];
      for (const c of d.challenges) for (const k of CUE_KEYS) if (c.cues?.[k]?.sound === ref) delete c.cues[k];
    });
    try { this.storage.removeItem(`ecocypher:sound:${id}`); } catch { /* ignore */ }
  }
  soundSrc(ref: string) {
    if (ref.startsWith("builtin:")) {
      const b = BUILTIN_SOUNDS.find((x) => x.ref === ref);
      return b?.file ? `${baseUrl()}${b.file}` : null;
    }
    if (ref.startsWith("upload:")) { try { return this.storage.getItem(`ecocypher:sound:${ref.slice(7)}`); } catch { return null; } }
    return null;
  }

  async deleteChallenge(id: string) {
    this.requireAdmin();
    this.commit((d) => {
      d.challenges = d.challenges.filter((c) => c.id !== id);
      d.submissions = d.submissions.filter((s) => s.challengeId !== id);
      d.hintUnlocks = d.hintUnlocks.filter((h) => h.challengeId !== id);
      d.waves = d.waves.filter((w) => d.challenges.some((c) => c.waveId === w.id));
    });
  }

  /**
   * Reads challenges from CSV (header: title,type,theme,points,flag,description,hint,hint_cost,attempts,files) or a JSON array.
   * `type` is a type name or id; `theme` one of plastics, energy, water, ewaste, food, climate; `files` is "name|url;name|url".
   * Returns the parsed challenges so the admin can review them in the form before posting.
   */
  parseChallengeFile(text: string): ParsedFile { return parseChallengeText(text, this.state.types); }

  // ---------------------------------------------------------------- admin: people
  private async newMember(teamId: string, teamName: string, displayName: string, index: number, taken: Set<string>): Promise<{ user: User; cred: Credential }> {
    const base = `${slug(teamName)}-${index}`;
    let username = base, n = 2;
    while (taken.has(username)) username = `${base}-${n++}`;
    taken.add(username);
    const password = tempPassword();
    const user = await makeUser({ id: randomId("u-"), username, displayName: displayName.trim() || `${teamName} member ${index}`, role: "player", teamId, mustChangePassword: true, password });
    return { user, cred: { team: teamName, displayName: user.displayName, username, password } };
  }

  async createTeam(name: string, members: string[]) {
    this.requireAdmin();
    const teamName = name.trim();
    const size = this.state.settings.teamSize;
    if (!teamName) throw new BackendError("Give the team a name.");
    if (this.state.teams.some((t) => t.name.toLowerCase() === teamName.toLowerCase())) throw new BackendError(`A team called "${teamName}" already exists.`);
    const names = members.map((m) => m.trim()).filter(Boolean);
    if (names.length === 0) throw new BackendError("Add the team's members.");
    if (names.length > size) throw new BackendError(`Teams have up to ${size} members. Change the team size in Settings if you need more.`);
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) throw new BackendError("Two members have the same name. Add a surname or initial so they can find themselves at login.");
    const team: Team = { id: randomId("t-"), name: teamName, createdAt: new Date().toISOString() };
    const taken = new Set(this.state.users.map((u) => u.username));
    const created: { user: User; cred: Credential }[] = [];
    for (const [i, m] of names.entries()) created.push(await this.newMember(team.id, teamName, m, i + 1, taken));
    this.commit((d) => { d.teams.push(team); d.users.push(...created.map((c) => c.user)); });
    return created.map((c) => c.cred);
  }

  /** CSV: team,member1,member2,member3 (header optional). */
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

  async renameTeam(id: string, name: string) {
    this.requireAdmin();
    if (!name.trim()) throw new BackendError("Team name can't be empty.");
    this.commit((d) => { const t = d.teams.find((x) => x.id === id); if (t) t.name = name.trim(); });
  }
  async deleteTeam(id: string) {
    this.requireAdmin();
    this.commit((d) => {
      d.teams = d.teams.filter((t) => t.id !== id);
      d.users = d.users.filter((u) => u.teamId !== id);
      d.submissions = d.submissions.filter((s) => s.teamId !== id);
      d.hintUnlocks = d.hintUnlocks.filter((h) => h.teamId !== id);
    });
  }
  async addMember(teamId: string, displayName: string) {
    this.requireAdmin();
    const team = this.state.teams.find((t) => t.id === teamId);
    if (!team) throw new BackendError("Team not found.");
    const count = this.state.users.filter((u) => u.teamId === teamId).length;
    if (count >= this.state.settings.teamSize) throw new BackendError(`${team.name} already has ${count} members, the team size limit.`);
    const x = await this.newMember(teamId, team.name, displayName, count + 1, new Set(this.state.users.map((u) => u.username)));
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
    return { team: this.state.teams.find((t) => t.id === u.teamId)?.name ?? "(admin)", displayName: u.displayName, username: u.username, password };
  }
  async deleteUser(userId: string) {
    const me = this.requireAdmin();
    if (userId === me.id) throw new BackendError("You can't delete your own account while logged in.");
    this.commit((d) => { d.users = d.users.filter((u) => u.id !== userId); });
  }

  // ---------------------------------------------------------------- admin: notifications and data
  async postNotification(title: string, body: string, level: NoticeLevel) {
    this.requireAdmin();
    if (!title.trim() && !body.trim()) throw new BackendError("Write a title or a message.");
    this.commit((d) => d.notifications.unshift({ id: randomId("n-"), title: title.trim(), body: body.trim(), level, at: new Date().toISOString() }));
  }
  async deleteNotification(id: string) { this.requireAdmin(); this.commit((d) => { d.notifications = d.notifications.filter((a) => a.id !== id); }); }

  async exportJSON() { this.requireAdmin(); return JSON.stringify(this.state, null, 2); }
  async importJSON(text: string) {
    this.requireAdmin();
    let d: DB;
    try { d = JSON.parse(text); } catch { throw new BackendError("That file isn't a valid EcoCypher backup."); }
    const m = migrate(d);
    if (!m || !Array.isArray(m.users)) throw new BackendError("That file isn't a valid EcoCypher backup.");
    d = m;
    if (!d.users.some((u) => u.role === "admin")) throw new BackendError("The backup has no admin account, so you'd be locked out.");
    this.state = d; this.persist(); this.emit();
  }
  async startFresh() {
    const me = this.requireAdmin();
    const old = this.state;
    const d = emptyDB();
    // Keep who you are and how the event is set up; wipe everything that happened in it.
    d.users = [{ ...me, mustChangePassword: false }];
    d.settings = { ...old.settings, startsAt: null, endsAt: null, freezeAt: null };
    d.types = old.types;
    d.soundboard = old.soundboard;
    this.state = d; this.persist();
    this.storage.setItem(SESSION, me.id);
    this.emit();
  }
  async loadDemo() {
    this.state = await demoDB(); this.persist();
    this.storage.removeItem(SESSION);
    this.emit();
  }
}
