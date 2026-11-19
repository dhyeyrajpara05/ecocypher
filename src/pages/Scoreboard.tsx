import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { Footer } from "../components/chrome";
import { CountUp, Empty } from "../components/ui";
import { scoreboard } from "../data/scoring";
import { useDB, useNow, useUser } from "../data/store";
import type { ScoreRow } from "../data/types";
import { clock, dateTime } from "../lib/format";

function Chart({ rows, start, end, colourOf }: { rows: ScoreRow[]; start: number; end: number; colourOf: (id: string) => string }) {
  const top = rows.slice(0, 5).filter((r) => r.score > 0);
  if (!top.length) return null;
  const W = 760, H = 230, P = { l: 44, r: 16, t: 12, b: 26 };
  const max = Math.max(...top.map((r) => r.score)) * 1.1;
  const clampY = (v: number) => Math.max(0, v);
  const x = (t: number) => P.l + ((t - start) / Math.max(1, end - start)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const ticks = [0, .25, .5, .75, 1].map((k) => Math.round(max * k / 50) * 50);
  return (
    <figure className="panel p-5">
      <figcaption className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
        {top.map((r, i) => <span key={r.teamId} className="inline-flex items-center gap-1.5"><i className="h-2 w-4 rounded-full" style={{ background: colourOf(r.teamId) }} />{r.teamName}</span>)}
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
          for (const h of r.history) { const t = Date.parse(h.at); d += ` H${x(t)} V${y(clampY(h.score))}`; prev = clampY(h.score); }
          d += ` H${x(end)}`;
          return (
            <g key={r.teamId}>
              <motion.path d={d} fill="none" stroke={colourOf(r.teamId)} strokeWidth={i === 0 ? 3 : 2.2} strokeLinejoin="round"
                {...({ initial: { pathLength: 0 }, animate: { pathLength: 1 } } as object)} transition={{ duration: 1.1, delay: i * .08 }} />
              <circle cx={x(end)} cy={y(prev)} r="4" fill={colourOf(r.teamId)} />
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

const SHARK = ["#1E5B7A", "#1F7A5C", "#8E4B7A", "#B88A1F", "#5C7A86", "#D9534F", "#2F8FA3", "#6A5ACD"];

function Shark({ colour, leader }: { colour: string; leader: boolean }) {
  return (
    <svg viewBox="0 0 64 34" width="58" height="31" aria-hidden="true">
      {leader && (
        <motion.path d="M30 4 l4 -4 l3 5 l4 -5 l3 5 l4 -4 l-2 9 h-14 z" fill="#E2B13C" stroke="#B88A1F" strokeWidth="1"
          animate={{ rotate: [-6, 6, -6], y: [0, -1.5, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} style={{ originX: "40px", originY: "10px" }} />
      )}
      <motion.path d="M2 20 L 10 12 L 9 20 L 10 28 Z" fill={colour} animate={{ rotate: [-12, 12, -12] }} transition={{ repeat: Infinity, duration: 0.45 }} style={{ originX: "10px", originY: "20px" }} />
      <path d="M9 20 C 16 10, 44 8, 62 20 C 46 30, 18 30, 9 20 Z" fill={colour} />
      <path d="M18 23 C 30 29, 48 28, 60 21 C 46 26, 30 26, 18 23 Z" fill="#fff" opacity=".85" />
      <path d="M30 13 L 36 4 L 40 13 Z" fill={colour} />
      <circle cx="51" cy="17" r="2" fill="#0B2A3C" />
      <path d="M52 22 l 2 2 l 2 -2 l 2 2" stroke="#0B2A3C" strokeWidth="1" fill="none" />
    </svg>
  );
}

function Confetti() {
  const bits = Array.from({ length: 36 });
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      {bits.map((_, i) => (
        <motion.span key={i} className="absolute top-0 block h-3 w-2 rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, background: ["#E2B13C", "#1F7A5C", "#D9534F", "#1E5B7A", "#A9DCD5"][i % 5] }}
          initial={{ y: -20, rotate: 0, opacity: 1 }} animate={{ y: "105vh", rotate: 540 + i * 20, opacity: [1, 1, 0] }}
          transition={{ duration: 2.2 + (i % 5) * 0.3, delay: (i % 7) * 0.08, ease: "easeIn" }} />
      ))}
    </div>
  );
}

/** Each team is a shark racing across its lane. Distance is its share of the leader's score. */
function SharkRace({ rows, colourOf, myTeam }: { rows: ScoreRow[]; colourOf: (id: string) => string; myTeam?: string | null }) {
  const max = Math.max(1, ...rows.map((r) => r.score));
  const [splash, setSplash] = useState<string | null>(null);
  return (
    <figure className="panel overflow-hidden p-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 text-[13px] text-deep/60">
        <span className="text-[16px] font-semibold text-deep">Shark race</span>
        <span>Tap a shark to make it splash</span>
      </figcaption>
      <ol className="mt-3 bg-[repeating-linear-gradient(180deg,#E6F5F2_0_44px,#D3EEEA_44px_88px)]">
        {rows.map((r) => {
          const pct = r.score > 0 ? (r.score / max) * 100 : 0;
          return (
            <li key={r.teamId} className="relative flex h-11 items-center border-b border-white/60 last:border-0">
              <span className={`z-10 w-28 shrink-0 truncate pl-4 text-[12.5px] font-semibold sm:w-40 ${r.teamId === myTeam ? "text-kelp-600" : "text-deep/75"}`}>{r.teamName}</span>
              <span className="relative mr-4 h-full flex-1">
                <span className="absolute inset-y-0 right-0 w-px border-r-2 border-dashed border-deep/20" aria-hidden="true" />
                <span className="absolute inset-y-0 left-0 right-[60px]">
                <motion.button type="button" className="absolute top-[6px] cursor-pointer"
                  initial={{ left: "0%" }} animate={{ left: `${pct}%`, y: splash === r.teamId ? [-14, 0] : [0, -2, 0] }}
                  transition={{ left: { type: "spring", stiffness: 40, damping: 14 }, y: splash === r.teamId ? { duration: 0.4 } : { repeat: Infinity, duration: 1.8 + (r.rank % 3) * 0.3 } }}
                  onClick={() => { setSplash(r.teamId); setTimeout(() => setSplash(null), 450); }}
                  aria-label={`${r.teamName}: ${r.score} points`}>
                  <Shark colour={colourOf(r.teamId)} leader={r.rank === 1 && r.score > 0} />
                </motion.button>
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

const RANK_KEY = "ecocypher:ranks";

/** Remembers each team's rank from the last visit, so the board can show who moved. */
function useRankMoves(rows: ScoreRow[]) {
  const [before] = useState<Record<string, number>>(() => { try { return JSON.parse(sessionStorage.getItem(RANK_KEY) ?? "{}"); } catch { return {}; } });
  const prevLeader = useRef<string | null>(rows[0]?.score ? rows[0].teamId : null);
  const [party, setParty] = useState(0);
  const leader = rows[0]?.score ? rows[0].teamId : null;
  useEffect(() => {
    try { sessionStorage.setItem(RANK_KEY, JSON.stringify(Object.fromEntries(rows.map((r) => [r.teamId, r.rank])))); } catch { /* ignore */ }
    if (leader && prevLeader.current && leader !== prevLeader.current) setParty((p) => p + 1);
    prevLeader.current = leader;
  }, [rows, leader]);
  return { move: (r: ScoreRow) => (before[r.teamId] ? before[r.teamId] - r.rank : 0), party };
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
  const colourOf = (id: string) => SHARK[Math.max(0, db.teams.findIndex((t) => t.id === id)) % SHARK.length];
  const { move, party } = useRankMoves(rows);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
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
            {party > 0 && <Confetti key={party} />}
            {party > 0 && (
              <motion.p key={`lead-${party}`} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} role="status"
                className="mt-6 rounded-2xl bg-brass px-5 py-3 text-[15px] font-semibold text-deep">New leader: {rows[0].teamName} takes the crown.</motion.p>
            )}
            <div className="mt-8"><SharkRace rows={rows} colourOf={colourOf} myTeam={user?.teamId} /></div>
            <div className="mt-6"><Chart rows={rows} start={start} end={end} colourOf={colourOf} /></div>
            <LayoutGroup>
              <ol className="mt-6 space-y-2">
                {rows.map((r) => {
                  const mine = user?.teamId === r.teamId;
                  const expanded = open === r.teamId;
                  return (
                    <motion.li layout key={r.teamId} transition={{ type: "spring", stiffness: 380, damping: 34 }}
                      className={`overflow-hidden rounded-2xl border ${mine ? "border-kelp/50 bg-kelp-100/60" : "border-fin-200/70 bg-white"}`}>
                      <button className="flex w-full items-center gap-4 px-4 py-3.5 text-left sm:px-5" onClick={() => setOpen(expanded ? null : r.teamId)} aria-expanded={expanded}>
                        <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-[15px] font-bold ${r.rank === 1 && r.score > 0 ? "bg-brass text-deep" : "bg-foam text-deep/70"}`}>
                          {r.rank}
                          {r.rank === 1 && r.score > 0 && <span className="absolute -top-3 text-[15px]" aria-label="leader">👑</span>}
                        </span>
                        <span className="w-9 shrink-0 text-center text-[12.5px] font-bold tabular">
                          {move(r) > 0 ? <motion.span initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-kelp" title={`Up ${move(r)} since you last looked`}>▲{move(r)}</motion.span>
                            : move(r) < 0 ? <motion.span initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-coral" title={`Down ${-move(r)} since you last looked`}>▼{-move(r)}</motion.span>
                            : <span className="text-deep/25" aria-hidden="true">–</span>}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-semibold">{r.teamName}{mine && <span className="ml-2 text-[12px] font-semibold text-kelp">your team</span>}</span>
                          <span className="text-[13px] text-deep/60">{r.solves} solved{r.lastSolveAt && `, last at ${clock(r.lastSolveAt)}`}{r.hintCost > 0 && <span className="text-coral">, −{r.hintCost} on hints</span>}</span>
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
                                    <motion.span className="block h-full rounded-full bg-kelp" initial={{ width: 0 }} animate={{ width: `${r.score + r.hintCost ? (m.points / (r.score + r.hintCost)) * 100 : 0}%` }} />
                                  </span>
                                  <span className="tabular text-right font-semibold">{m.points}</span>
                                </li>
                              ))}
                              {r.hintCost > 0 && <li className="text-[13px] text-coral">Hints opened: −{r.hintCost} points from the team total</li>}
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
      <Footer />
    </div>
  );
}
