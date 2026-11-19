import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { CountUp, Empty, Modal, RoundChip, TypeChip, useToast } from "../components/ui";
import { eventStatus, roundStatus, scoreboard, solveCounts, solves, visibleChallenges } from "../data/scoring";
import { useBackend, useDB, useNow, useUser } from "../data/store";
import type { Challenge } from "../data/types";
import { ago, clock, countdown } from "../lib/format";

function Coins() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <motion.span key={i} className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-brass shadow"
            initial={{ x: 0, y: 0, opacity: 1, scale: .6 }}
            animate={{ x: Math.cos(a) * 110, y: Math.sin(a) * 70 - 20, opacity: 0, scale: 1 }}
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
  const [flag, setFlag] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const type = db.types.find((t) => t.id === c?.typeId);
  const round = db.rounds.find((r) => r.id === c?.roundId);
  const solve = c && solves(db).find((s) => s.teamId === user.teamId && s.challengeId === c.id);
  const solver = solve && db.users.find((u) => u.id === solve.userId);
  const attempts = c ? db.submissions.filter((s) => s.teamId === user.teamId && s.challengeId === c.id && !s.correct).length : 0;
  const closed = round ? roundStatus(round) === "closed" : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!c) return;
    setBusy(true);
    const r = await be.submitFlag(c.id, flag);
    setBusy(false);
    setMsg({ tone: r.correct ? "ok" : "bad", text: r.message });
    if (r.correct && !r.alreadySolved) { setCelebrate((x) => x + 1); setFlag(""); toast(`${c.title}: +${r.points} points`, "ok"); }
  }

  return (
    <Modal open={!!c} onClose={() => { setMsg(null); setFlag(""); setShowHint(false); onClose(); }} title={c?.title ?? ""} wide>
      {c && (
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <TypeChip type={type} />
            <span className="chip bg-brass-100 text-brass-600">{c.points} points</span>
            <span className="text-deep/60">{round?.name}</span>
          </div>
          <div className="mt-5 whitespace-pre-line text-[15.5px] leading-relaxed text-deep/90">{c.description || "No description yet."}</div>
          {c.files.length > 0 && (
            <div className="mt-5">
              <p className="label">Files</p>
              <ul className="flex flex-wrap gap-2">
                {c.files.map((f) => <li key={f.url}><a className="btn btn-line btn-sm" href={f.url} target="_blank" rel="noreferrer">{f.name}</a></li>)}
              </ul>
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
            ) : closed ? (
              <p className="rounded-2xl bg-foam px-4 py-3 text-[15px] text-deep/70">{round?.name} has closed, so this challenge no longer accepts flags.</p>
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

export default function Play() {
  const db = useDB();
  const user = useUser()!;
  const now = useNow(1000);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const team = db.teams.find((t) => t.id === user.teamId);
  const board = scoreboard(db);
  const row = board.find((r) => r.teamId === user.teamId);
  const me = row?.members.find((m) => m.userId === user.id);
  const counts = solveCounts(db);
  const mySolved = new Set(solves(db).filter((s) => s.teamId === user.teamId).map((s) => s.challengeId));
  const visible = visibleChallenges(db, now);
  const rounds = useMemo(() => [...db.rounds].sort((a, b) => a.order - b.order), [db.rounds]);
  const ev = eventStatus(db, now);
  const nextRound = rounds.find((r) => roundStatus(r, now) === "upcoming");
  const current = db.challenges.find((c) => c.id === openId) ?? null;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <section className="relative overflow-hidden rounded-3xl bg-deep px-6 py-7 text-white sm:px-8">
          <div className="relative grid gap-6 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:items-end">
            <div>
              <p className="text-[13px] text-aqua/80">Your startup</p>
              <h1 className="mt-1 text-[26px] font-bold leading-tight">{team?.name ?? "No team"}</h1>
            </div>
            <div><p className="text-[13px] text-aqua/80">Team valuation</p><CountUp value={row?.score ?? 0} className="font-display text-[30px] font-bold text-brass" /></div>
            <div><p className="text-[13px] text-aqua/80">Rank</p><p className="font-display text-[30px] font-bold">{row ? `${row.rank} of ${board.length}` : "-"}</p></div>
            <div><p className="text-[13px] text-aqua/80">You've added</p><p className="font-display text-[30px] font-bold"><span className="tabular">{me?.points ?? 0}</span></p></div>
          </div>
          <p className="relative mt-5 text-[14px] text-aqua/85">
            {ev === "before" && db.settings.startsAt && <>The event starts in <b className="tabular text-white">{countdown(db.settings.startsAt, now)}</b>.</>}
            {ev === "live" && db.settings.endsAt && <>Submissions close in <b className="tabular text-white">{countdown(db.settings.endsAt, now)}</b>. </>}
            {ev === "live" && nextRound?.opensAt && <><b className="text-white">{nextRound.name}</b> opens in <b className="tabular text-white">{countdown(nextRound.opensAt, now)}</b>.</>}
            {ev === "after" && <>The event has ended. Submissions are closed.</>}
          </p>
        </section>

        {db.announcements.length > 0 && (
          <section className="mt-6 rounded-2xl border border-brass/40 bg-brass-100/60 px-5 py-4" aria-label="Announcements">
            <p className="text-[14.5px]"><b>{clock(db.announcements[0].at)}</b> {db.announcements[0].text}</p>
            {db.announcements.length > 1 && (
              <details className="mt-1 text-[13.5px] text-deep/70"><summary className="cursor-pointer">Earlier announcements</summary>
                <ul className="mt-2 space-y-1">{db.announcements.slice(1).map((a) => <li key={a.id}><b>{clock(a.at)}</b> {a.text}</li>)}</ul>
              </details>
            )}
          </section>
        )}

        <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter by challenge type">
          <button className={`chip px-3.5 py-1.5 text-[13px] ${typeFilter === "all" ? "bg-deep text-white" : "bg-white text-deep ring-1 ring-fin-200"}`} onClick={() => setTypeFilter("all")}>All types</button>
          {db.types.map((t) => (
            <button key={t.id} className={`chip px-3.5 py-1.5 text-[13px] ${typeFilter === t.id ? "text-white" : "bg-white ring-1 ring-fin-200"}`}
              style={typeFilter === t.id ? { background: t.colour } : { color: t.colour }} onClick={() => setTypeFilter(t.id)}>{t.name}</button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="mt-8"><Empty title="No challenges are open yet">{nextRound?.opensAt ? `${nextRound.name} opens in ${countdown(nextRound.opensAt, now)}.` : "The first funding round will open soon. This page updates on its own."}</Empty></div>
        ) : rounds.map((r) => {
          const st = roundStatus(r, now);
          const list = visible.filter((c) => c.roundId === r.id && (typeFilter === "all" || c.typeId === typeFilter)).sort((a, b) => a.points - b.points);
          if (!["open", "closed"].includes(st) || list.length === 0) return null;
          const done = list.filter((c) => mySolved.has(c.id)).length;
          return (
            <section key={r.id} className="mt-10">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-[20px] font-bold">{r.name}</h2>
                <RoundChip status={st} />
                <span className="text-[13.5px] text-deep/60">{done} of {list.length} solved</span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => {
                  const solved = mySolved.has(c.id);
                  const type = db.types.find((t) => t.id === c.typeId);
                  return (
                    <li key={c.id}>
                      <button onClick={() => setOpenId(c.id)}
                        className={`group relative flex h-full w-full flex-col rounded-2xl border p-5 text-left transition-colors ${solved ? "border-kelp/40 bg-kelp-100/50" : "border-fin-200/80 bg-white hover:border-deep/30"}`}>
                        <span className="absolute inset-y-4 left-0 w-1 rounded-r-full" style={{ background: type?.colour }} />
                        <span className="flex items-center justify-between gap-2"><TypeChip type={type} />
                          <span className="font-display text-[18px] font-bold text-deep">{c.points}</span></span>
                        <span className="mt-3 text-[16.5px] font-semibold leading-snug">{c.title}</span>
                        <span className="mt-auto pt-4 text-[13px] text-deep/60">
                          {solved ? <span className="font-semibold text-kelp">Solved by your team</span> : `${counts.get(c.id) ?? 0} team${(counts.get(c.id) ?? 0) === 1 ? "" : "s"} solved`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>
      <ChallengeModal c={current} onClose={() => setOpenId(null)} />
    </div>
  );
}
