import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Footer } from "../components/chrome";
import { Confetti } from "../components/Confetti";
import { isMuted, useMute } from "../components/Faaah";
import { SiteHeader } from "../components/SiteHeader";
import { Tank } from "../components/Tank";
import { defaultFinals, finalStandings } from "../data/scoring";
import { useDB, useUser } from "../data/store";
import type { FinalRow } from "../data/types";
import { dateTime } from "../lib/format";

// ------------------------------------------------------------------ sound (synthesised, no files)
let ac: AudioContext | null = null;
const audio = () => { try { return (ac ??= new AudioContext()); } catch { return null; } };
function drumroll(seconds: number) {
  const a = audio(); if (!a || isMuted()) return;
  const len = a.sampleRate * .05, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 5));
  let t = a.currentTime;
  const end = t + seconds;
  while (t < end) {
    const p = 1 - (end - t) / seconds, src = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    src.buffer = buf; f.type = "bandpass"; f.frequency.value = 900; g.gain.value = .12 + .35 * p;
    src.connect(f).connect(g).connect(a.destination); src.start(t);
    t += .075 - .045 * p;
  }
}
function chime(freqs: number[], when = 0, dur = .9, vol = .16) {
  const a = audio(); if (!a || isMuted()) return;
  freqs.forEach((fr, i) => {
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + when + i * .06;
    o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = fr;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .05);
  });
}
function crash() {
  const a = audio(); if (!a || isMuted()) return;
  const len = a.sampleRate * 1.6, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 6));
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = "highpass"; f.frequency.value = 3500; g.gain.value = .3;
  src.connect(f).connect(g).connect(a.destination); src.start();
  chime([261.6, 329.6, 392, 523.3, 659.3, 784], .02, 1.8, .14);
}

// ------------------------------------------------------------------ small pieces
function Count({ value, decimals = 1, run }: { value: number; decimals?: number; run: boolean }) {
  const [v, setV] = useState(run ? 0 : value);
  useEffect(() => {
    if (!run) { setV(value); return; }
    let raf = 0; const start = performance.now(), dur = 1100;
    const step = (t: number) => { const k = Math.min(1, (t - start) / dur); setV(value * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, run]);
  return <span className="tabular">{v.toFixed(decimals)}</span>;
}

const PLACE = {
  1: { label: "1st", block: "from-[#F6D27A] via-brass to-[#9C7316]", ring: "#E2B13C", h: "h-48 sm:h-64", word: "Champions" },
  2: { label: "2nd", block: "from-[#EEF6F5] via-aqua-400 to-fin", ring: "#A9DCD5", h: "h-36 sm:h-48", word: "Runners-up" },
  3: { label: "3rd", block: "from-[#F1C3A0] via-[#C98B5B] to-[#7E4E2A]", ring: "#C98B5B", h: "h-28 sm:h-36", word: "Third place" },
} as const;

function Trophy() {
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 sm:h-20 sm:w-20 drop-shadow-[0_0_18px_rgba(226,177,60,.7)]" aria-hidden="true">
      <path d="M20 8h24v14a12 12 0 0 1-24 0z" fill="#E2B13C" />
      <path d="M20 12h-8a8 8 0 0 0 8 10M44 12h8a8 8 0 0 1-8 10" fill="none" stroke="#E2B13C" strokeWidth="3.5" />
      <path d="M28 34h8v8h-8z" fill="#B88A1F" /><rect x="22" y="42" width="20" height="6" rx="2" fill="#B88A1F" /><rect x="18" y="48" width="28" height="7" rx="2" fill="#E2B13C" />
      <path d="M26 12l3 7-5 4 7 1 1 6 3-6 6-1-5-4 2-7-6 4z" fill="#FBF0D2" opacity=".85" />
    </svg>
  );
}

function PodiumSpot({ row, place, shown, run }: { row?: FinalRow; place: 1 | 2 | 3; shown: boolean; run: boolean }) {
  const p = PLACE[place];
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-end">
      <AnimatePresence>
        {shown && row && (
          <motion.div key="card" className="relative mb-3 w-full text-center"
            initial={run ? { opacity: 0, y: 40, scale: .8 } : false} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 160, damping: 14 }}>
            {place === 1 && (
              <>
                <motion.div className="pointer-events-none absolute left-1/2 top-6 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60"
                  style={{ background: "repeating-conic-gradient(from 0deg, rgba(226,177,60,.35) 0deg 8deg, transparent 8deg 22deg)", maskImage: "radial-gradient(circle, #000 20%, transparent 68%)", WebkitMaskImage: "radial-gradient(circle, #000 20%, transparent 68%)" }}
                  animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 24, ease: "linear" }} />
                <motion.div className="mx-auto w-fit" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}><Trophy /></motion.div>
                <motion.span className="absolute left-[calc(50%+22px)] top-0 rounded-md border-2 border-coral bg-deep/60 px-1.5 py-0.5 font-display text-[11px] font-bold uppercase text-coral sm:left-[calc(50%+36px)] sm:rounded-lg sm:border-[3px] sm:px-2 sm:text-[20px]"
                  initial={run ? { scale: 3, rotate: -30, opacity: 0 } : false} animate={{ scale: 1, rotate: -12, opacity: 1 }} transition={{ delay: run ? .45 : 0, type: "spring", stiffness: 260, damping: 12 }}>
                  Deal!
                </motion.span>
              </>
            )}
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: p.ring }}>{p.word}</p>
            <p className={`mt-1 break-words font-display font-bold leading-tight text-white ${place === 1 ? "text-[16px] sm:text-[30px]" : "text-[13.5px] sm:text-[22px]"}`}>{row.teamName}</p>
            <p className={`whitespace-nowrap font-display font-bold ${place === 1 ? "text-[28px] sm:text-[52px]" : "text-[21px] sm:text-[38px]"}`} style={{ color: p.ring }}>
              <Count value={row.combined} decimals={row.combined % 1 ? 1 : 0} run={run} /><span className="ml-1 text-[11px] font-medium text-aqua/70 sm:text-[15px]">pts</span>
            </p>
            <p className="text-[11px] leading-snug text-aqua/75 sm:text-[13px]"><span className="whitespace-nowrap">CTF {row.ctfScore.toLocaleString("en-IN")}</span> + <span className="whitespace-nowrap">Judges {row.pitchAvg ?? 0}</span></p>
            {row.members.length > 0 && <p className="mt-1 hidden truncate text-[12px] text-aqua/55 sm:block">{row.members.join(", ")}</p>}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div className={`relative w-full overflow-hidden rounded-t-2xl bg-gradient-to-b ${p.block} ${p.h} shadow-[0_-8px_40px_rgba(0,0,0,.35)]`}
        initial={run ? { scaleY: 0 } : false} animate={{ scaleY: shown || !run ? 1 : .12 }} style={{ transformOrigin: "bottom" }} transition={{ type: "spring", stiffness: 120, damping: 16 }}>
        <span className="absolute inset-x-0 top-3 text-center font-display text-[40px] font-bold text-white/90 drop-shadow sm:text-[64px]">{place}</span>
        <motion.span className="absolute inset-y-0 w-1/3 -skew-x-12 bg-white/25" initial={{ left: "-40%" }} animate={{ left: "140%" }} transition={{ repeat: Infinity, duration: 3.2, delay: place * .4, repeatDelay: 2 }} />
      </motion.div>
    </div>
  );
}

// ------------------------------------------------------------------ page
export default function Results() {
  const db = useDB();
  const user = useUser();
  const reduce = useReducedMotion();
  const [muted, toggleMute] = useMute();
  const isAdmin = user?.role === "admin";
  const f = db.finals ?? defaultFinals();
  const preview = isAdmin && !f.published;
  const rows: FinalRow[] | null = useMemo(() => (f.published && f.snapshot ? f.snapshot : isAdmin ? finalStandings(db) : null), [db, f, isAdmin]);
  const top = Math.max(1, ...(rows ?? []).map((r) => Math.max(0, r.ctfScore) + (r.pitchAvg ?? 0)));
  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 });

  // The reveal: 0 = drumroll, 1 = 3rd, 2 = 2nd, 3 = 1st (+ confetti), 4 = everyone. Plays once per published result per browser.
  const key = `ecocypher:results-seen:${f.publishedAt ?? "preview"}`;
  const [stage, setStage] = useState(() => { try { return reduce || localStorage.getItem(key) ? 4 : 0; } catch { return 0; } });
  const [run, setRun] = useState(stage === 0);
  const [boom, setBoom] = useState(0);
  const timers = useRef<number[]>([]);
  const play = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setRun(true); setStage(0); drumroll(1.7);
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    at(1800, () => { setStage(1); chime([392, 523.3]); });
    at(2900, () => { setStage(2); chime([440, 587.3, 740]); });
    at(4300, () => { setStage(3); crash(); setBoom((b) => b + 1); });
    at(5600, () => { setStage(4); try { localStorage.setItem(key, "1"); } catch { /* ignore */ } });
  };
  useEffect(() => { if (stage === 0 && rows && rows.length) play(); return () => timers.current.forEach(clearTimeout); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const skip = () => { timers.current.forEach(clearTimeout); setStage(4); setRun(false); try { localStorage.setItem(key, "1"); } catch { /* ignore */ } };

  if (!rows || rows.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-deep text-white">
        <SiteHeader dark />
        <main className="relative grid flex-1 place-items-center overflow-hidden px-6 py-20 text-center">
          <div className="absolute inset-0 opacity-70"><Tank surface={20} /></div>
          <div className="relative">
            <p className="font-display text-[30px] font-bold sm:text-[40px]">The sharks are still deciding</p>
            <p className="mx-auto mt-3 max-w-md text-aqua/80">Final results appear here once the CTF and the Shark Tank pitches are scored. Watch your notifications.</p>
            <Link className="btn btn-brass mt-6" to="/scoreboard">See the CTF scoreboard</Link>
          </div>
        </main>
        <Footer dark />
      </div>
    );
  }

  const [first, second, third] = rows;
  const rest = rows.slice(3);
  return (
    <div className="flex min-h-screen flex-col bg-deep text-white">
      <SiteHeader dark />
      <Confetti fire={boom} />
      {preview && (
        <p className="relative z-10 bg-brass px-5 py-2 text-center text-[14px] font-semibold text-deep">
          Preview: players can't see this page until you publish it from <Link className="underline" to="/admin/finals">Admin → Final results</Link>. Scores below are live.
        </p>
      )}
      <main className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-60"><Tank surface={16} /></div>
        <section className="relative mx-auto max-w-5xl px-5 pb-2 pt-8 text-center sm:px-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-brass">{db.settings.eventName} · Final results</p>
          <h1 className="mt-2 font-display text-[32px] font-bold leading-tight sm:text-[48px]">The sharks have decided</h1>
          <p className="mx-auto mt-2 max-w-xl text-[14.5px] text-aqua/80">CTF points plus the judges' Shark Tank score. The highest total wins.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button className="btn btn-ghost-light btn-sm" onClick={play}>Replay the reveal</button>
            <button className="btn btn-ghost-light btn-sm" onClick={toggleMute} aria-pressed={muted}>{muted ? "Sound off" : "Sound on"}</button>
          </div>
        </section>

        {/* drumroll card */}
        <AnimatePresence>
          {stage === 0 && (
            <motion.div key="roll" className="absolute inset-x-0 top-[30%] z-20 px-4 text-center" initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }}>
              <motion.p className="font-display text-[30px] font-bold text-brass sm:text-[46px]" animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: .35 }}>
                And the deal goes to…
              </motion.p>
              <button className="mt-4 text-[13px] text-aqua/70 underline" onClick={skip}>Skip</button>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="relative mx-auto flex max-w-4xl items-end gap-2 px-3 pt-20 sm:gap-5 sm:px-8 sm:pt-24" aria-label="Top three teams">
          <PodiumSpot row={second} place={2} shown={stage >= 2} run={run} />
          <PodiumSpot row={first} place={1} shown={stage >= 3} run={run} />
          <PodiumSpot row={third} place={3} shown={stage >= 1} run={run} />
        </section>
        <div className="relative mx-auto h-3 max-w-4xl rounded-b-xl bg-black/30" />

        {/* everyone else */}
        <motion.section className="relative mx-auto max-w-4xl px-5 py-12 sm:px-8" initial={false} animate={{ opacity: stage >= 4 ? 1 : 0, y: stage >= 4 ? 0 : 30 }} transition={{ duration: .6 }} aria-label="Every team">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-[22px] font-bold">Every team</h2>
            <p className="flex items-center gap-4 text-[12.5px] text-aqua/80">
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-full bg-kelp-300" />CTF points</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-4 rounded-full bg-brass" />Judges' average</span>
            </p>
          </div>
          <ol className="space-y-2">
            {rows.map((r, i) => {
              const ctfPart = Math.max(0, r.ctfScore) / top * 100, pitchPart = (r.pitchAvg ?? 0) / top * 100;
              return (
                <motion.li key={r.teamId} className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-2xl px-4 py-3 ${i < 3 ? "bg-white/10 ring-1 ring-brass/40" : "bg-white/5"}`}
                  initial={false} animate={{ opacity: stage >= 4 ? 1 : 0, x: stage >= 4 ? 0 : -20 }} transition={{ delay: stage >= 4 && run ? i * .05 : 0 }}>
                  <span className={`grid h-9 w-9 place-items-center rounded-full font-display text-[15px] font-bold ${i < 3 ? "bg-brass text-deep" : "bg-white/10 text-aqua"}`}>{r.rank}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.teamName}</span>
                    <span className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-white/10" role="img" aria-label={`CTF ${r.ctfScore} points plus judges ${r.pitchAvg ?? 0}`}>
                      <motion.span className="h-full bg-kelp-300" initial={false} animate={{ width: stage >= 4 ? `${ctfPart}%` : "0%" }} transition={{ duration: .8, delay: run ? .2 + i * .05 : 0 }} />
                      <motion.span className="h-full bg-brass" initial={false} animate={{ width: stage >= 4 ? `${pitchPart}%` : "0%" }} transition={{ duration: .8, delay: run ? .45 + i * .05 : 0 }} />
                    </span>
                    <span className="mt-1 block text-[12px] text-aqua/65">CTF {fmt(r.ctfScore)} pts + judges {r.pitchAvg === null ? "not scored" : `${fmt(r.pitchAvg)} / ${f.pitchMax}`}</span>
                  </span>
                  <span className="text-right font-display text-[22px] font-bold text-white">{fmt(r.combined)}</span>
                </motion.li>
              );
            })}
          </ol>
          {rest.length === 0 && rows.length < 4 && <p className="mt-3 text-[13px] text-aqua/60">That's every team.</p>}
          <p className="mt-6 text-[12.5px] leading-relaxed text-aqua/65">
            How it's scored: each team's CTF points (after hint costs) plus the average of the judges' Shark Tank scores. The highest total wins;
            a tie goes to the team with more CTF points.
            {f.publishedAt && <> Published {dateTime(f.publishedAt)}.</>}
          </p>
        </motion.section>
      </main>
      <Footer dark />
    </div>
  );
}
