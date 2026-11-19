import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { AgentNotice } from "../components/AgentNotice";
import { BigTimer, Footer, useEventClock } from "../components/chrome";
import { SiteHeader } from "../components/SiteHeader";
import { THEME_INFO, ThemeArt } from "../components/themes";
import { CountUp, Empty, Modal, TypeChip, useToast } from "../components/ui";
import { scoreboard, solveCounts, solves, visibleChallenges } from "../data/scoring";
import { useBackend, useDB, useNow, useUser } from "../data/store";
import type { Challenge } from "../data/types";
import { ago, clock } from "../lib/format";

function Coins() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <motion.span key={i} className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-brass shadow"
            initial={{ x: 0, y: 0, opacity: 1, scale: .6 }} animate={{ x: Math.cos(a) * 110, y: Math.sin(a) * 70 - 20, opacity: 0, scale: 1 }}
            transition={{ duration: .9, ease: "easeOut" }} />
        );
      })}
    </div>
  );
}

function ChallengeModal({ c, onClose }: { c: Challenge | null; onClose: () => void }) {
  const be = useBackend();
  const db = useDB();
  const user = useUser()!;
  const toast = useToast();
  const clockState = useEventClock();
  const [flag, setFlag] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const type = db.types.find((t) => t.id === c?.typeId);
  const wave = db.waves.find((w) => w.id === c?.waveId);
  const solve = c && solves(db).find((s) => s.teamId === user.teamId && s.challengeId === c.id);
  const solver = solve && db.users.find((u) => u.id === solve.userId);
  const attempts = c ? db.submissions.filter((s) => s.teamId === user.teamId && s.challengeId === c.id && !s.correct).length : 0;
  const theme = c ? THEME_INFO[c.theme] : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!c) return;
    setBusy(true);
    const r = await be.submitFlag(c.id, flag);
    setBusy(false);
    setMsg({ tone: r.correct ? "ok" : "bad", text: r.message });
    if (r.correct && !r.alreadySolved) { setCelebrate((x) => x + 1); setFlag(""); toast(`${c.title}: +${r.points} points for your team`, "ok"); }
  }

  return (
    <Modal open={!!c} onClose={() => { setMsg(null); setFlag(""); setShowHint(false); onClose(); }} title={c?.title ?? ""} wide>
      {c && theme && (
        <div>
          <AgentNotice />
          <div className="-mx-6 -mt-2 mb-5 flex items-center gap-4 px-6 py-4 sm:-mx-8 sm:px-8" style={{ background: theme.tint }}>
            <ThemeArt theme={c.theme} size={48} />
            <div className="text-[13.5px]">
              <p className="font-semibold" style={{ color: theme.ink }}>{theme.label}</p>
              <p className="text-deep/70">{theme.fact}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <TypeChip type={type} />
            <span className="chip bg-brass-100 text-brass-600">{c.points} points</span>
            <span className="text-deep/60">{wave ? `Wave ${wave.number}` : "Single challenge"}</span>
          </div>
          <div className="mt-5 whitespace-pre-line text-[15.5px] leading-relaxed text-deep/90">{c.description || "No description yet."}</div>
          {c.files.length > 0 && (
            <div className="mt-5">
              <p className="label">Files</p>
              <ul className="flex flex-wrap gap-2">{c.files.map((f) => <li key={f.url}><a className="btn btn-line btn-sm" href={f.url} target="_blank" rel="noreferrer noopener">{f.name}</a></li>)}</ul>
            </div>
          )}
          {c.hint && (
            <div className="mt-5">
              {showHint ? <p className="rounded-xl bg-aqua-200 px-4 py-3 text-[14.5px]"><b>Hint:</b> {c.hint}</p>
                : <button className="text-[14px] font-semibold text-kelp underline-offset-4 hover:underline" onClick={() => setShowHint(true)}>Show hint</button>}
            </div>
          )}
          <div className="relative mt-7 border-t border-fin-200/70 pt-6">
            {celebrate > 0 && <Coins key={celebrate} />}
            {solve ? (
              <motion.p initial={{ scale: .95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-2xl bg-kelp-100 px-4 py-3 text-[15px] text-kelp-600">
                <b>Deal done.</b> {solver?.id === user.id ? "You" : solver?.displayName ?? "Your team"} solved this {ago(solve.at)} for {c.points} points.
              </motion.p>
            ) : clockState.status !== "live" ? (
              <p className="rounded-2xl bg-foam px-4 py-3 text-[15px] text-deep/70">{clockState.status === "ended" ? "Time's up. Flags can no longer be submitted." : "Flags open when the 3-hour clock starts."}</p>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
                <label htmlFor="flag" className="sr-only">Flag</label>
                <input id="flag" className="field font-mono" placeholder="ECO{...}" value={flag} onChange={(e) => setFlag(e.target.value)} autoComplete="off" spellCheck={false} />
                <button className="btn btn-kelp shrink-0" disabled={busy || !flag.trim()}>{busy ? "Checking…" : "Submit flag"}</button>
              </form>
            )}
            <AnimatePresence>
              {msg && !solve && (
                <motion.p key={msg.text + attempts} initial={{ opacity: 0, x: msg.tone === "bad" ? -8 : 0 }} animate={{ opacity: 1, x: 0 }}
                  transition={msg.tone === "bad" ? { type: "spring", stiffness: 600, damping: 12 } : undefined}
                  role="status" className={`mt-3 text-[14px] font-medium ${msg.tone === "ok" ? "text-kelp" : "text-coral"}`}>{msg.text}</motion.p>
              )}
            </AnimatePresence>
            {!solve && attempts > 0 && <p className="mt-2 text-[13px] text-deep/55">Your team has tried {attempts} wrong flag{attempts === 1 ? "" : "s"} here.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Card({ c, solved, solvedBy, onOpen, fresh }: { c: Challenge; solved: boolean; solvedBy: number; onOpen: () => void; fresh: boolean }) {
  const db = useDB();
  const type = db.types.find((t) => t.id === c.typeId);
  const th = THEME_INFO[c.theme];
  return (
    <button onClick={onOpen}
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-[22px] border text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 ${solved ? "border-kelp/50" : "border-fin-200/80 hover:border-deep/30"}`}
      style={{ background: solved ? "#DCF1E8" : "#fff" }}>
      <span className="relative flex items-start justify-between gap-2 px-5 pb-3 pt-5" style={{ background: solved ? "transparent" : th.tint }}>
        <span>
          <span className="block text-[12.5px] font-semibold" style={{ color: th.ink }}>{th.label}</span>
          <span className="mt-1.5 block text-[17px] font-semibold leading-snug text-deep">{c.title}</span>
        </span>
        <span className="shrink-0 opacity-90 transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105"><ThemeArt theme={c.theme} size={56} /></span>
        {/* wave edge between the illustrated band and the card body */}
        <svg className="absolute -bottom-px left-0 h-3 w-full" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 6 Q 25 0 50 6 T 100 6 T 150 6 T 200 6 V12 H0Z" fill={solved ? "#DCF1E8" : "#fff"} />
        </svg>
      </span>
      <span className="flex flex-1 flex-col px-5 pb-5 pt-2">
        <span className="flex items-center justify-between gap-2"><TypeChip type={type} /><span className="font-display text-[20px] font-bold text-deep">{c.points}</span></span>
        <span className="mt-auto pt-4 text-[13px] text-deep/60">
          {solved ? <span className="inline-flex items-center gap-1.5 font-semibold text-kelp-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5L20 7" /></svg>Solved by your team</span>
            : `${solvedBy} team${solvedBy === 1 ? "" : "s"} solved`}
        </span>
      </span>
      {fresh && !solved && <span className="absolute right-3 top-3 rounded-full bg-coral px-2 py-0.5 text-[11px] font-bold text-white">New</span>}
    </button>
  );
}

export default function Play() {
  const db = useDB();
  const user = useUser()!;
  const now = useNow(1000);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const team = db.teams.find((t) => t.id === user.teamId);
  const board = scoreboard(db);
  const row = board.find((r) => r.teamId === user.teamId);
  const counts = solveCounts(db);
  const mySolved = new Set(solves(db).filter((s) => s.teamId === user.teamId).map((s) => s.challengeId));
  const visible = visibleChallenges(db, now).filter((c) => typeFilter === "all" || c.typeId === typeFilter);
  const current = db.challenges.find((c) => c.id === openId) ?? null;
  const waves = [...db.waves].sort((a, b) => b.number - a.number);
  const singles = visible.filter((c) => !c.waveId).sort((a, b) => Date.parse(b.releaseAt!) - Date.parse(a.releaseAt!));
  const isFresh = (c: Challenge) => now.getTime() - Date.parse(c.releaseAt!) < 15 * 60_000;
  const grid = (list: Challenge[]) => (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((c) => <li key={c.id}><Card c={c} solved={mySolved.has(c.id)} solvedBy={counts.get(c.id) ?? 0} onOpen={() => setOpenId(c.id)} fresh={isFresh(c)} /></li>)}
    </ul>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <AgentNotice />
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
        <section className="relative overflow-hidden rounded-3xl bg-deep px-6 py-7 text-white sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <p className="text-[13px] text-aqua/80">Your startup</p>
              <h1 className="mt-1 text-[28px] font-bold leading-tight">{team?.name ?? "No team"}</h1>
              <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
                <div><p className="text-[13px] text-aqua/80">Team valuation</p><CountUp value={row?.score ?? 0} className="font-display text-[30px] font-bold text-brass" /></div>
                <div><p className="text-[13px] text-aqua/80">Rank</p><p className="font-display text-[30px] font-bold">{row ? `${row.rank} of ${board.length}` : "-"}</p></div>
              </div>
              <ul className="mt-5 flex flex-wrap gap-2" aria-label="Team members">
                {row?.members.map((m) => (
                  <li key={m.userId} className={`rounded-full px-3 py-1 text-[13px] ${m.userId === user.id ? "bg-brass text-deep" : "bg-white/10 text-aqua"}`}>
                    {m.name.split(" ")[0]}{m.userId === user.id && " (you)"} <b className="tabular">{m.points}</b>
                  </li>
                ))}
              </ul>
            </div>
            <BigTimer />
          </div>
        </section>

        {db.notifications[0] && (
          <a href="#/notifications" className={`mt-6 block rounded-2xl border px-5 py-3.5 text-[14.5px] ${db.notifications[0].level === "important" ? "border-coral/40 bg-coral-100/60" : "border-brass/40 bg-brass-100/60"}`}>
            <b className="tabular">{clock(db.notifications[0].at)}</b> <b>{db.notifications[0].title}</b> {db.notifications[0].body}
            <span className="ml-2 font-semibold text-kelp">All notifications</span>
          </a>
        )}

        <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter by challenge type">
          <button className={`chip px-3.5 py-1.5 text-[13px] ${typeFilter === "all" ? "bg-deep text-white" : "bg-white text-deep ring-1 ring-fin-200"}`} onClick={() => setTypeFilter("all")}>All types</button>
          {db.types.map((t) => (
            <button key={t.id} className={`chip px-3.5 py-1.5 text-[13px] ${typeFilter === t.id ? "text-white" : "bg-white ring-1 ring-fin-200"}`}
              style={typeFilter === t.id ? { background: t.colour } : { color: t.colour }} onClick={() => setTypeFilter(t.id)}>{t.name}</button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="mt-8"><Empty title="No challenges are live yet">New challenges appear here the moment the organisers post them. This page updates on its own.</Empty></div>
        ) : (
          <>
            {singles.length > 0 && (
              <section className="mt-10">
                <div className="mb-4 flex flex-wrap items-baseline gap-3"><h2 className="text-[20px] font-bold">Single challenges</h2><span className="text-[13.5px] text-deep/60">Posted one at a time, newest first</span></div>
                {grid(singles)}
              </section>
            )}
            {waves.map((w) => {
              const list = visible.filter((c) => c.waveId === w.id).sort((a, b) => a.points - b.points);
              if (!list.length) return null;
              return (
                <section key={w.id} className="mt-10">
                  <div className="mb-4 flex flex-wrap items-baseline gap-3"><h2 className="text-[20px] font-bold">Wave {w.number}</h2><span className="text-[13.5px] text-deep/60">{list.filter((c) => mySolved.has(c.id)).length} of {list.length} solved</span></div>
                  {grid(list)}
                </section>
              );
            })}
          </>
        )}
      </main>
      <Footer />
      <ChallengeModal c={current} onClose={() => setOpenId(null)} />
    </div>
  );
}
