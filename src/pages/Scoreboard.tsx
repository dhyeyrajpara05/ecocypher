import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useState } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { CountUp, Empty } from "../components/ui";
import { scoreboard } from "../data/scoring";
import { useDB, useNow, useUser } from "../data/store";
import type { ScoreRow } from "../data/types";
import { clock, dateTime } from "../lib/format";

const LINE = ["#E2B13C", "#1F7A5C", "#1E5B7A", "#8E4B7A", "#5C7A86"];

function Chart({ rows, start, end }: { rows: ScoreRow[]; start: number; end: number }) {
  const top = rows.slice(0, 5).filter((r) => r.score > 0);
  if (!top.length) return null;
  const W = 760, H = 230, P = { l: 44, r: 16, t: 12, b: 26 };
  const max = Math.max(...top.map((r) => r.score)) * 1.1;
  const x = (t: number) => P.l + ((t - start) / Math.max(1, end - start)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const ticks = [0, .25, .5, .75, 1].map((k) => Math.round(max * k / 50) * 50);
  return (
    <figure className="panel p-5">
      <figcaption className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
        {top.map((r, i) => <span key={r.teamId} className="inline-flex items-center gap-1.5"><i className="h-2 w-4 rounded-full" style={{ background: LINE[i] }} />{r.teamName}</span>)}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Valuation over time for the top teams">
        {ticks.map((v) => (
          <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#CCDADF" strokeDasharray="3 4" />
            <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#5C7A86">{v}</text></g>
        ))}
        <text x={P.l} y={H - 6} fontSize="11" fill="#5C7A86">{clock(new Date(start).toISOString())}</text>
        <text x={W - P.r} y={H - 6} fontSize="11" fill="#5C7A86" textAnchor="end">{clock(new Date(end).toISOString())}</text>
        {top.map((r, i) => {
          let d = `M${x(start)},${y(0)}`;
          let prev = 0;
          for (const h of r.history) { const t = Date.parse(h.at); d += ` H${x(t)} V${y(h.score)}`; prev = h.score; }
          d += ` H${x(end)}`;
          return (
            <g key={r.teamId}>
              <motion.path d={d} fill="none" stroke={LINE[i]} strokeWidth={i === 0 ? 3 : 2.2} strokeLinejoin="round"
                {...({ initial: { pathLength: 0 }, animate: { pathLength: 1 } } as object)} transition={{ duration: 1.1, delay: i * .08 }} />
              <circle cx={x(end)} cy={y(prev)} r="4" fill={LINE[i]} />
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export default function Scoreboard() {
  const db = useDB();
  const user = useUser();
  const now = useNow(5000);
  const [open, setOpen] = useState<string | null>(null);
  const isAdmin = user?.role === "admin";
  const frozen = db.settings.freezeAt && !isAdmin ? new Date(db.settings.freezeAt) : undefined;
  const rows = scoreboard(db, { until: frozen && frozen < now ? frozen : undefined });
  const hidden = !db.settings.scoreboardVisible && !isAdmin;
  const firstSolve = db.submissions.filter((s) => s.correct).map((s) => Date.parse(s.at)).sort((a, b) => a - b)[0];
  const start = db.settings.startsAt ? Date.parse(db.settings.startsAt) : firstSolve ?? now.getTime() - 3600_000;
  const end = Math.min(now.getTime(), frozen ? frozen.getTime() : Infinity);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-bold">The tank</h1>
            <p className="mt-1 max-w-xl text-[15px] text-deep/70">Teams ranked by valuation. If two teams have the same points, the team that reached them first ranks higher.</p>
          </div>
          {frozen && frozen < now && <p className="rounded-full bg-brass-100 px-4 py-1.5 text-[13px] font-semibold text-brass-600">Frozen at {dateTime(db.settings.freezeAt)}. Final standings at the reveal.</p>}
        </div>

        {hidden ? (
          <div className="mt-10"><Empty title="The scoreboard is hidden for now">The organisers will reveal it soon. Keep solving.</Empty></div>
        ) : rows.length === 0 ? (
          <div className="mt-10"><Empty title="No teams in the tank yet">Teams appear here once the organisers add them.</Empty></div>
        ) : (
          <>
            <div className="mt-8"><Chart rows={rows} start={start} end={end} /></div>
            <LayoutGroup>
              <ol className="mt-6 space-y-2">
                {rows.map((r) => {
                  const mine = user?.teamId === r.teamId;
                  const expanded = open === r.teamId;
                  return (
                    <motion.li layout key={r.teamId} transition={{ type: "spring", stiffness: 380, damping: 34 }}
                      className={`overflow-hidden rounded-2xl border ${mine ? "border-kelp/50 bg-kelp-100/60" : "border-fin-200/70 bg-white"}`}>
                      <button className="flex w-full items-center gap-4 px-4 py-3.5 text-left sm:px-5" onClick={() => setOpen(expanded ? null : r.teamId)} aria-expanded={expanded}>
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-[15px] font-bold ${r.rank === 1 && r.score > 0 ? "bg-brass text-deep" : "bg-foam text-deep/70"}`}>{r.rank}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-semibold">{r.teamName}{mine && <span className="ml-2 text-[12px] font-semibold text-kelp">your team</span>}</span>
                          <span className="text-[13px] text-deep/60">{r.solves} solved{r.lastSolveAt && `, last at ${clock(r.lastSolveAt)}`}</span>
                        </span>
                        <span className="text-right">
                          <CountUp value={r.score} className="font-display text-[22px] font-bold" />
                          <span className="block text-[12px] text-deep/55">points</span>
                        </span>
                        <svg className={`shrink-0 text-fin transition-transform ${expanded ? "rotate-180" : ""}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                      </button>
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                            <ul className="space-y-2 border-t border-fin-200/60 px-5 py-4">
                              {r.members.map((m) => (
                                <li key={m.userId} className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-3 text-[14px] sm:grid-cols-[12rem_1fr_5rem]">
                                  <span className="truncate">{m.name}</span>
                                  <span className="h-2 overflow-hidden rounded-full bg-foam">
                                    <motion.span className="block h-full rounded-full bg-kelp" initial={{ width: 0 }} animate={{ width: `${r.score ? (m.points / r.score) * 100 : 0}%` }} />
                                  </span>
                                  <span className="tabular text-right font-semibold">{m.points}</span>
                                </li>
                              ))}
                            </ul>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  );
                })}
              </ol>
            </LayoutGroup>
          </>
        )}
      </main>
    </div>
  );
}
