import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AgentNotice } from "../components/AgentNotice";
import { BigTimer, Footer } from "../components/chrome";
import { SiteHeader } from "../components/SiteHeader";
import { Tank } from "../components/Tank";
import { THEME_INFO, ThemeArt } from "../components/themes";
import { CountUp } from "../components/ui";
import { scoreboard, visibleChallenges } from "../data/scoring";
import { useDB, useNow, useUser } from "../data/store";
import type { ThemeKey } from "../data/types";

function useNarrow() {
  const q = "(max-width: 767px)";
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const f = () => setNarrow(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return narrow;
}

export default function Landing() {
  const db = useDB();
  const user = useUser();
  const now = useNow(5000);
  const narrow = useNarrow();
  const rows = scoreboard(db, { until: db.settings.freezeAt ? new Date(db.settings.freezeAt) : undefined }).slice(0, 3);
  const live = visibleChallenges(db, now).length;
  const themes: ThemeKey[] = ["plastics", "energy", "water", "ewaste", "food", "climate"];

  return (
    <div className="min-h-screen">
      <AgentNotice />
      <section className="relative isolate overflow-hidden bg-deep text-white">
        <Tank surface={narrow ? 9 : 30} />
        <SiteHeader dark />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-24 pt-14 sm:px-8 md:grid-cols-[1.15fr_.85fr] md:pt-24 lg:pb-28">
          <div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, ease: [0.2, .7, .2, 1] }}
              className="max-w-xl text-[40px] font-bold leading-[1.08] sm:text-[56px]">
              {db.settings.tagline}
            </motion.h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-aqua/90">
              {db.settings.eventName} is a three-hour sustainability capture-the-flag. Your team is a startup in the tank. Every flag you
              capture is investment from the sharks.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Link to={user.role === "admin" ? "/admin" : "/play"} className="btn btn-brass">{user.role === "admin" ? "Open the admin dashboard" : "Go to challenges"}</Link>
              ) : (
                <Link to="/login" className="btn btn-brass">Log in to your team</Link>
              )}
              <Link to="/scoreboard" className="btn btn-ghost-light">See the scoreboard</Link>
            </div>
            <div className="mt-10"><BigTimer /></div>
          </div>

          <div className="self-end md:mb-2">
            <div className="rounded-3xl border border-white/10 bg-white/[.06] p-5 backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-[15px] font-semibold text-white">Top of the tank</h2>
                <span className="text-[12px] text-aqua/80">{live} challenge{live === 1 ? "" : "s"} live</span>
              </div>
              {db.settings.scoreboardVisible && rows.some((r) => r.score > 0) ? (
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
          <h2 className="text-[28px] font-bold leading-tight">How it works</h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {[
              ["Log in as yourself", "Your team has three members, each with their own login. Every flag any of you captures counts for the team."],
              ["Crack the challenges", "Organisers post challenges in waves of five, plus single surprise challenges. Watch the notifications."],
              ["Beat the clock", "You have three hours. Highest valuation wins. Level on points? The team that got there first ranks higher."],
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
            <h2 className="text-[28px] font-bold leading-tight">The waste trail</h2>
            <p className="mt-3 max-w-xs text-[15px] text-deep/70">Every challenge follows a real sustainability problem on a fictional campus.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((k) => (
              <li key={k} className="flex items-start gap-3 rounded-2xl p-4" style={{ background: THEME_INFO[k].tint }}>
                <ThemeArt theme={k} size={40} />
                <span><b className="block text-[15px]" style={{ color: THEME_INFO[k].ink }}>{THEME_INFO[k].label}</b><span className="text-[13.5px] text-deep/75">{THEME_INFO[k].fact}</span></span>
              </li>
            ))}
          </ul>
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
            <li><b>Keep flags inside your team.</b> Shared answers show up in the organisers' logs.</li>
            <li><b>Guess slowly.</b> Rapid-fire guessing is rate-limited. Read the challenge again instead.</li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  );
}
