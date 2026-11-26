import { useEffect, useState } from "react";
import { Footer } from "../components/chrome";
import { SiteHeader } from "../components/SiteHeader";
import { THEME_INFO, ThemeArt } from "../components/themes";
import { TypeChip, useRun } from "../components/ui";
import { useBackend, useDB, useUser } from "../data/store";
import type { ReleaseStatus, TesterChallenge } from "../data/types";
import { dateTime } from "../lib/format";

const STATUS: Record<ReleaseStatus, [string, string]> = {
  draft: ["bg-fin-200/50 text-fin", "Draft"],
  scheduled: ["bg-brass-100 text-brass-600", "Scheduled"],
  live: ["bg-kelp-100 text-kelp-600", "Live"],
  archived: ["bg-fin-200/50 text-deep/60", "Archived"],
};
const ORDER: ReleaseStatus[] = ["live", "scheduled", "draft", "archived"];

/**
 * Testing page (/all-challenge-view): every challenge in any status, with full hints, private file downloads
 * and a flag checker that records nothing. Open to the admin, or anyone with the testing password from Settings.
 * The password lives only in this tab's memory, never in storage.
 */
export default function AllChallengeView() {
  const be = useBackend();
  const db = useDB();
  const user = useUser();
  const isAdmin = user?.role === "admin";
  const [pw, setPw] = useState("");
  const [typed, setTyped] = useState("");
  const [list, setList] = useState<TesterChallenge[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | ReleaseStatus>("all");

  const load = async (password: string) => {
    setBusy(true); setError("");
    try { setList(await be.testerChallenges(password)); setPw(password); }
    catch (e) { setError((e as Error).message); setList(null); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (isAdmin) void load(""); }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const types = new Map(db.types.map((t) => [t.id, t]));
  const shown = (list ?? []).filter((c) => filter === "all" || c.status === filter)
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (a.waveNumber ?? 999) - (b.waveNumber ?? 999) || a.points - b.points);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="font-display text-[32px] font-bold">Testing page</h1>
        <p className="mt-1 max-w-2xl text-[14.5px] text-deep/70">
          Every challenge in any status, with full hints and files. The flag checker tells you if a flag is right without recording a submission, using an attempt or scoring points.
        </p>

        {!list && !isAdmin && (
          <form className="panel mt-6 flex max-w-md flex-col gap-3 p-5" onSubmit={(e) => { e.preventDefault(); void load(typed); }}>
            <label className="label" htmlFor="tpw">Testing password</label>
            <input id="tpw" type="password" className="field" autoComplete="current-password" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
            {error && <p role="alert" className="rounded-xl bg-coral-100 px-3.5 py-2.5 text-[14px] text-coral">{error}</p>}
            <button className="btn btn-kelp self-start" disabled={!typed || busy}>{busy ? "Checking…" : "Open"}</button>
            <p className="text-[13px] text-deep/60">The admin sets this password in Settings. Admins can open the page while logged in.</p>
          </form>
        )}
        {isAdmin && !list && <p className="mt-6 text-[14px] text-deep/60">{error || "Loading every challenge…"}</p>}

        {list && (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
              {(["all", ...ORDER] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`chip px-3.5 py-1.5 text-[13px] ${filter === f ? "bg-deep text-white" : "bg-white ring-1 ring-fin-200"}`}>
                  {f === "all" ? "All" : STATUS[f][1]} <span className="opacity-60">{f === "all" ? list.length : list.filter((c) => c.status === f).length}</span>
                </button>
              ))}
              <button className="btn btn-line btn-sm ml-auto" disabled={busy} onClick={() => load(pw)}>Refresh</button>
            </div>
            {shown.length === 0 && <p className="mt-6 text-[14px] text-deep/60">No challenges here.</p>}
            <ul className="mt-5 space-y-4">
              {shown.map((c) => <TestCard key={c.id} c={c} type={types.get(c.typeId)} password={pw} />)}
            </ul>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function TestCard({ c, type, password }: { c: TesterChallenge; type: Parameters<typeof TypeChip>[0]["type"]; password: string }) {
  const be = useBackend();
  const run = useRun();
  const [flag, setFlag] = useState("");
  const [result, setResult] = useState<null | boolean>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const check = async () => {
    setBusy(true); setError(""); setResult(null);
    try { setResult((await be.testerCheckFlag(password, c.id, flag)).correct); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <li className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3" style={{ background: THEME_INFO[c.theme].tint }}>
        <ThemeArt theme={c.theme} size={36} />
        <span className="min-w-[10rem] flex-1">
          <span className="block text-[17px] font-bold">{c.title}</span>
          <span className="flex flex-wrap items-center gap-2 text-[13px] text-deep/65">
            <TypeChip type={type} />{c.points} points, {c.waveNumber ? `Wave ${c.waveNumber}` : "single"}, {c.maxAttempts ? `${c.maxAttempts} attempts` : "unlimited attempts"},
            {c.caseSensitive ? " case-sensitive flag" : " flag not case-sensitive"}, {c.solves} team{c.solves === 1 ? "" : "s"} solved
          </span>
        </span>
        <span className="text-right text-[13px]">
          <span className={`chip ${STATUS[c.status][0]}`}>{STATUS[c.status][1]}{c.hidden ? ", hidden" : ""}</span>
          {c.status === "scheduled" && <span className="block pt-0.5 text-deep/60">{dateTime(c.releaseAt)}</span>}
        </span>
      </div>
      <div className="space-y-4 px-5 py-4">
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-deep/90">{c.description || "No description."}</p>
        {c.files.length > 0 && (
          <div>
            <p className="label">Files</p>
            <ul className="flex flex-wrap gap-2">
              {c.files.map((f) => <li key={f.url}><button type="button" className="btn btn-line btn-sm" onClick={() => run(be.downloadFile(f, password || undefined))}>{f.name}</button></li>)}
            </ul>
          </div>
        )}
        {c.hints.length > 0 && (
          <div>
            <p className="label">Hints</p>
            <ol className="list-decimal space-y-1 pl-5 text-[14.5px]">
              {c.hints.map((h, i) => <li key={i}>{h.text} <span className="text-deep/55">({h.cost ? `costs ${h.cost} points` : "free"})</span></li>)}
            </ol>
          </div>
        )}
        <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={(e) => { e.preventDefault(); void check(); }}>
          <label className="sr-only" htmlFor={`flag-${c.id}`}>Flag to check for {c.title}</label>
          <input id={`flag-${c.id}`} className="field font-mono" placeholder="Check a flag (nothing is recorded)" value={flag} onChange={(e) => { setFlag(e.target.value); setResult(null); }} />
          <button className="btn btn-kelp shrink-0" disabled={!flag.trim() || busy}>{busy ? "Checking…" : "Check flag"}</button>
        </form>
        {result !== null && <p role="status" className={`rounded-xl px-3.5 py-2.5 text-[14px] font-semibold ${result ? "bg-kelp-100 text-kelp-600" : "bg-coral-100 text-coral"}`}>{result ? "Correct flag." : "Not the flag."}</p>}
        {error && <p role="alert" className="rounded-xl bg-coral-100 px-3.5 py-2.5 text-[14px] text-coral">{error}</p>}
      </div>
    </li>
  );
}
