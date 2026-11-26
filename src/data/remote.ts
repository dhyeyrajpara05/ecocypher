/**
 * RemoteBackend: the version used for the real event. Every action goes to the server (/api/rpc) and
 * every browser checks /api/state every few seconds, so admin changes (clock, releases, edits,
 * notifications) reach all players within about 3 seconds. The server only ever sends this browser
 * the data its user may see.
 */
import { BackendError, isPrivateFile, parseChallengeText, triggerDownload, type Backend, type ChallengeInput, type Credential, type ParsedFile } from "./backend";
import { BUILTIN_SOUNDS } from "./sounds";
import type { BulkAction, Challenge, ChallengeFile, ChallengeType, Cue, CueKey, DB, Hint, NoticeLevel, Settings, SoundMeta, SubmitResult, TesterChallenge, User } from "./types";

const TOKEN = "ecocypher:token";
const POLL_MS = 3000;
const HIDDEN_POLL_MS = 15000;

interface StateBody { v: number; now: number; me: string | null; view: DB; token?: string; tokenValid?: boolean; result?: unknown; error?: string }

export class RemoteBackend implements Backend {
  private state!: DB;
  private me: string | null = null;
  private v = 0;
  private t = 0;
  private token: string | null = null;
  private listeners = new Set<() => void>();
  private loading: Promise<void>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private api = (p: string) => new URL(`api/${p}`, location.origin + import.meta.env.BASE_URL).toString();

  constructor() {
    try { this.token = localStorage.getItem(TOKEN); } catch { /* storage blocked */ }
    this.loading = this.refresh(true).then(() => {
      this.schedule();
      document.addEventListener("visibilitychange", () => { if (!document.hidden) void this.refresh(false); this.schedule(); });
      window.addEventListener("focus", () => void this.refresh(false));
    });
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(async () => { await this.refresh(false).catch(() => {}); this.schedule(); }, document.hidden ? HIDDEN_POLL_MS : POLL_MS);
  }

  private headers(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  private setToken(t: string | null) {
    this.token = t;
    try { if (t) localStorage.setItem(TOKEN, t); else localStorage.removeItem(TOKEN); } catch { /* ignore */ }
  }

  private apply(b: StateBody) {
    this.state = b.view;
    this.v = b.v;
    this.t = b.now;
    this.me = b.me;
    if (b.token !== undefined) this.setToken(b.token || null);
    if (b.tokenValid === false) this.setToken(null);
    this.emit();
  }

  /** Fetches the latest view. With `force`, always downloads it; otherwise the server answers 204 if nothing changed. */
  private async refresh(force: boolean) {
    const r = await fetch(`${this.api("state")}?v=${force ? 0 : this.v}&t=${this.t}`, { headers: this.headers(), cache: "no-store" });
    if (r.status === 204) return;
    const b = (await r.json()) as StateBody;
    if (!r.ok) throw new BackendError(b.error ?? `The server answered ${r.status}.`);
    this.apply(b);
  }

  private async call<T>(method: string, ...args: unknown[]): Promise<T> {
    // JSON turns a missing argument into null, which means something different (e.g. "unpublish"), so drop trailing ones.
    while (args.length && args[args.length - 1] === undefined) args.pop();
    let r: Response;
    try {
      r = await fetch(this.api("rpc"), { method: "POST", headers: { "Content-Type": "application/json", ...this.headers() }, body: JSON.stringify({ method, args }) });
    } catch { throw new BackendError("Can't reach the server. Check your connection and try again."); }
    const b = (await r.json().catch(() => ({}))) as StateBody;
    if (!r.ok) throw new BackendError(b.error ?? `The server answered ${r.status}.`);
    this.apply(b);
    return b.result as T;
  }

  ready() { return this.loading; }
  db() { return this.state; }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((f) => f()); }
  currentUser(): User | null { return this.state?.users.find((u) => u.id === this.me) ?? null; }

  login(username: string, password: string) { return this.call<User>("login", username, password); }
  loginMember(teamId: string, userId: string, password: string) { return this.call<User>("loginMember", teamId, userId, password); }
  logout() { this.setToken(null); this.me = null; this.emit(); void this.refresh(true); }
  changePassword(current: string, next: string) { return this.call<void>("changePassword", current, next); }
  submitFlag(challengeId: string, value: string) { return this.call<SubmitResult>("submitFlag", challengeId, value); }
  unlockHint(challengeId: string, index: number) { return this.call<Hint>("unlockHint", challengeId, index); }

  updateSettings(patch: Partial<Settings>) { return this.call<void>("updateSettings", patch); }
  startTimer() { return this.call<void>("startTimer"); }
  extendTimer(minutes: number) { return this.call<void>("extendTimer", minutes); }
  endEventNow() { return this.call<void>("endEventNow"); }
  resetTimer() { return this.call<void>("resetTimer"); }
  updateType(id: string, patch: Partial<ChallengeType>) { return this.call<void>("updateType", id, patch); }

  postWave(items: ChallengeInput[], releaseAt: string | null) { return this.call<Challenge[]>("postWave", items, releaseAt); }
  saveChallenge(id: string | null, input: ChallengeInput, releaseAt?: string | null) { return this.call<Challenge>("saveChallenge", id, input, releaseAt); }
  setRelease(id: string, releaseAt: string | null) { return this.call<void>("setRelease", id, releaseAt); }
  groupIntoWave(ids: string[]) { return this.call<void>("groupIntoWave", ids); }
  splitWave(waveId: string) { return this.call<void>("splitWave", waveId); }
  addAttempts(id: string, extra: number) { return this.call<void>("addAttempts", id, extra); }
  deleteChallenge(id: string) { return this.call<void>("deleteChallenge", id); }
  bulkChallenges(action: BulkAction, ids: string[], at?: string) { return this.call<{ changed: number; skipped: number }>("bulkChallenges", action, ids, at); }
  uploadFile(name: string, dataUrl: string) { return this.call<ChallengeFile>("uploadFile", name, dataUrl); }
  async downloadFile(file: ChallengeFile, testerPassword?: string) {
    if (!isPrivateFile(file.url)) { window.open(file.url, "_blank", "noopener"); return; }
    let r: Response;
    try {
      r = await fetch(this.api(file.url.slice(5)), { headers: { ...this.headers(), ...(testerPassword ? { "X-Tester-Password": testerPassword } : {}) }, cache: "no-store" });
    } catch { throw new BackendError("Can't reach the server. Check your connection and try again."); }
    if (!r.ok) throw new BackendError(r.status === 401 ? "Log in again to download this file." : "That file isn't available.");
    const href = URL.createObjectURL(await r.blob());
    triggerDownload(href, file.name);
    setTimeout(() => URL.revokeObjectURL(href), 5000);
  }
  testerChallenges(password: string) { return this.call<TesterChallenge[]>("testerChallenges", password); }
  testerCheckFlag(password: string, challengeId: string, value: string) { return this.call<{ correct: boolean }>("testerCheckFlag", password, challengeId, value); }
  setTesterPassword(password: string) { return this.call<void>("setTesterPassword", password); }
  parseChallengeFile(text: string): ParsedFile { return parseChallengeText(text, this.state.types); }

  createTeam(name: string, members: string[]) { return this.call<Credential[]>("createTeam", name, members); }
  importTeams(csv: string) { return this.call<{ credentials: Credential[]; errors: string[] }>("importTeams", csv); }
  renameTeam(id: string, name: string) { return this.call<void>("renameTeam", id, name); }
  deleteTeam(id: string) { return this.call<void>("deleteTeam", id); }
  addMember(teamId: string, displayName: string) { return this.call<Credential>("addMember", teamId, displayName); }
  resetPassword(userId: string) { return this.call<Credential>("resetPassword", userId); }
  deleteUser(userId: string) { return this.call<void>("deleteUser", userId); }

  updateCue(key: CueKey, cue: Cue) { return this.call<void>("updateCue", key, cue); }
  uploadSound(name: string, dataUrl: string) { return this.call<SoundMeta>("uploadSound", name, dataUrl); }
  deleteSound(id: string) { return this.call<void>("deleteSound", id); }
  soundSrc(ref: string) {
    if (ref.startsWith("builtin:")) { const b = BUILTIN_SOUNDS.find((x) => x.ref === ref); return b?.file ? import.meta.env.BASE_URL + b.file : null; }
    if (ref.startsWith("upload:")) return this.api(`sound?id=${encodeURIComponent(ref.slice(7))}`);
    return null;
  }
  postNotification(title: string, body: string, level: NoticeLevel) { return this.call<void>("postNotification", title, body, level); }
  deleteNotification(id: string) { return this.call<void>("deleteNotification", id); }
  exportJSON() { return this.call<string>("exportJSON"); }
  importJSON(text: string) { return this.call<void>("importJSON", text); }
  startFresh() { return this.call<void>("startFresh"); }
  loadDemo() { return this.call<void>("loadDemo"); }
}
