import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { Tank } from "../components/Tank";
import { CountUp, RoundChip } from "../components/ui";
import { eventStatus, roundStatus, scoreboard } from "../data/scoring";
import { useDB, useNow, useUser } from "../data/store";
import { countdown, dateTime } from "../lib/format";

function useNarrow() {
  const q = "(max-width: 767px)";
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const f = () => setNarrow(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return narrow;
}

export default function Landing() {
  const narrow = useNarrow();
  const db = useDB();
  const user = useUser();
  const now = useNow();
  const rows = scoreboard(db, { until: db.settings.freezeAt ? new Date(db.settings.freezeAt) : undefined }).slice(0, 3);
  const rounds = [...db.rounds].sort((a, b) => a.order - b.order).filter((r) => r.state !== "draft");
  const openRound = rounds.find((r) => roundStatus(r, now) === "open");
  const ev = eventStatus(db, now);
  const nextRound = rounds.find((r) => roundStatus(r, now) === "upcoming");

  return (
    <div className="min-h-screen">
      <section className="relative isolate overflow-hidden bg-deep text-white">
        <Tank surface={narrow ? 9 : 30} />
        <SiteHeader dark />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-24 pt-14 sm:px-8 md:grid-cols-[1.15fr_.85fr] md:pt-24 lg:pb-32">
          <div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, ease: [0.2, .7, .2, 1] }}
              className="max-w-xl text-[40px] font-bold leading-[1.08] sm:text-[56px]">
              {db.settings.tagline}
            </motion.h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-aqua/90">
              {db.settings.eventName} is a one-day sustainability capture-the-flag. Your team is a startup in the tank. Every flag you capture is
              investment from the sharks, and new challenges arrive in funding rounds.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Link to={user.role === "admin" ? "/admin" : "/play"} className="btn btn-brass">{user.role === "admin" ? "Open the Sharks' Desk" : "Go to challenges"}</Link>
              ) : (
                <Link to="/login" className="btn btn-brass">Log in with your team sheet</Link>
              )}
              <Link to="/scoreboard" className="btn btn-ghost-light">See the scoreboard</Link>
            </div>
            <p className="mt-8 text-[14px] text-aqua/80" aria-live="polite">
              {ev === "before" && db.settings.startsAt && <>Doors open in <b className="tabular text-white">{countdown(db.settings.startsAt, now)}</b></>}
              {ev === "live" && openRound && <><b className="text-white">{openRound.name}</b> is open{db.settings.endsAt && <> and the tank closes in <b className="tabular text-white">{countdown(db.settings.endsAt, now)}</b></>}</>}
              {ev === "live" && !openRound && nextRound?.opensAt && <><b className="text-white">{nextRound.name}</b> opens in <b className="tabular text-white">{countdown(nextRound.opensAt, now)}</b></>}
              {ev === "after" && <>The tank is closed. Thanks for playing.</>}
            </p>
          </div>

          <div className="self-end md:mb-2">
            <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5 backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-[15px] font-semibold text-white">Top of the tank</h2>
                {db.settings.freezeAt && <span className="text-[12px] text-brass">Frozen</span>}
              </div>
              {db.settings.scoreboardVisible && rows.length > 0 ? (
                <ol className="space-y-2">
                  {rows.map((r, i) => (
                    <li key={r.teamId} className="flex items-center gap-3 rounded-2xl bg-deep/60 px-4 py-3">
                      <span className={`grid h-8 w-8 place-items-center rounded-full font-display text-sm font-bold ${i === 0 ? "bg-brass text-deep" : "bg-white/10 text-aqua"}`}>{r.rank}</span>
                      <span className="flex-1 truncate font-medium">{r.teamName}</span>
                      <CountUp value={r.score} className="font-display font-semibold text-brass" />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[14px] text-aqua/80">Standings appear once the first flag lands.</p>
              )}
              <Link to="/scoreboard" className="mt-3 inline-block text-[13px] font-semibold text-aqua underline-offset-4 hover:underline">Full scoreboard</Link>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="grid gap-10 py-20 md:grid-cols-[.8fr_1.2fr]">
          <h2 className="text-[28px] font-bold leading-tight">How a round works</h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {[
              ["Log in as your startup", "Every member has their own login. Your points add up to your team's valuation."],
              ["Crack the round", "Each funding round releases a new wave of challenges. Find the flag, submit it, bank the points."],
              ["Climb the tank", "Higher valuation ranks higher. Level on points? The team that got there first wins the tie."],
            ].map(([t, d], i) => (
              <li key={t}>
                <span className="font-display text-[40px] font-bold leading-none text-kelp-300">{i + 1}</span>
                <h3 className="mt-3 text-[17px] font-semibold">{t}</h3>
                <p className="mt-2 text-[15px] text-deep/75">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-10 border-t border-fin-200/70 py-20 md:grid-cols-[.8fr_1.2fr]">
          <div>
            <h2 className="text-[28px] font-bold leading-tight">Funding rounds</h2>
            <p className="mt-3 max-w-xs text-[15px] text-deep/70">Rounds open on a schedule. Challenges from earlier rounds stay open until their round closes.</p>
          </div>
          {rounds.length ? (
            <ul className="divide-y divide-fin-200/70 border-y border-fin-200/70">
              {rounds.map((r) => {
                const st = roundStatus(r, now);
                const count = db.challenges.filter((c) => c.roundId === r.id && !c.hidden).length;
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-4">
                    <span className="min-w-[10rem] font-display text-[17px] font-semibold">{r.name}</span>
                    <RoundChip status={st} />
                    <span className="text-[14px] text-deep/70">
                      {st === "upcoming" && `Opens ${dateTime(r.opensAt)}`}
                      {st === "open" && `${count} challenge${count === 1 ? "" : "s"} live`}
                      {st === "closed" && "No longer accepting flags"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-deep/70">The first round will appear here when the organisers schedule it.</p>}
        </section>

        <section className="grid gap-10 border-t border-fin-200/70 py-20 md:grid-cols-[.8fr_1.2fr]">
          <h2 className="text-[28px] font-bold leading-tight">Four kinds of challenge</h2>
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {db.types.map((t) => (
              <li key={t.id} className="border-l-4 pl-4" style={{ borderColor: t.colour }}>
                <h3 className="font-sans text-[17px] font-semibold">{t.name}</h3>
                <p className="text-[15px] text-deep/70">{t.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-10 border-t border-fin-200/70 py-20 md:grid-cols-[.8fr_1.2fr]">
          <h2 className="text-[28px] font-bold leading-tight">Play fair</h2>
          <ul className="space-y-4 text-[15.5px]">
            <li><b>Use AI to learn, not to solve.</b> Ask it how SQL joins work, not for the answer. Every team must be able to explain how it got each flag.</li>
            <li><b>Keep flags inside your team.</b> Shared flags show up in the organisers' logs.</li>
            <li><b>Guess slowly.</b> Rapid-fire guessing is rate-limited. Read the challenge again instead.</li>
          </ul>
        </section>
      </main>
      <footer className="border-t border-fin-200/70">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-5 py-8 text-[13px] text-fin sm:px-8">
          <span>{db.settings.eventName}, a sustainability capture-the-flag. Companies and people in the challenges are fictional.</span>
          <span>Organised by the EcoCypher team</span>
        </div>
      </footer>
    </div>
  );
}
