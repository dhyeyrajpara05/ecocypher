import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { BigTimer, useEventClock } from "../../components/chrome";
import { THEME_INFO } from "../../components/themes";
import { useToast } from "../../components/ui";
import { releaseStatus, scoreboard, solves } from "../../data/scoring";
import { useBackend, useDB, useNow } from "../../data/store";
import { ago, clock } from "../../lib/format";

function SolvesChart() {
  const db = useDB();
  const now = useNow(10000);
  const s = solves(db);
  const start = db.settings.startsAt ? Date.parse(db.settings.startsAt) : s[0] ? Date.parse(s[0].at) : now.getTime() - 3600_000;
  const end = Math.max(start + 60_000, Math.min(now.getTime(), db.settings.endsAt ? Date.parse(db.settings.endsAt) : Infinity));
  const buckets = 18;
  const counts = Array(buckets).fill(0);
  for (const x of s) {
    const t = Date.parse(x.at);
    if (t < start || t > end) continue;
    counts[Math.min(buckets - 1, Math.floor(((t - start) / (end - start)) * buckets))]++;
  }
  const max = Math.max(1, ...counts);
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Solves over time">
        {counts.map((c, i) => (
          <motion.div key={i} className="flex-1 rounded-t-md bg-kelp" initial={{ height: 0 }} animate={{ height: `${(c / max) * 100}%` }} transition={{ delay: i * .02 }}
            title={`${c} solve${c === 1 ? "" : "s"}`} style={{ minHeight: c ? 4 : 2, opacity: c ? 1 : .2 }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-deep/55"><span>{clock(new Date(start).toISOString())}</span><span>{clock(new Date(end).toISOString())}</span></div>
    </div>
  );
}

export default function Dashboard() {
  const be = useBackend();
  const db = useDB();
  const now = useNow(1000);
  const toast = useToast();
  const t = useEventClock();
  const rows = scoreboard(db);
  const s = solves(db);
  const players = db.users.filter((u) => u.role === "player");
  const live = db.challenges.filter((c) => !c.hidden && releaseStatus(c, now) === "live");
  const scheduled = db.challenges.filter((c) => releaseStatus(c, now) === "scheduled").sort((a, b) => Date.parse(a.releaseAt!) - Date.parse(b.releaseAt!));
  const drafts = db.challenges.filter((c) => releaseStatus(c, now) === "draft");
  const recent = [...db.submissions].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 12);
  const accuracy = db.submissions.length ? Math.round((db.submissions.filter((x) => x.correct).length / db.submissions.length) * 100) : 0;
  const active = new Set(db.submissions.filter((x) => now.getTime() - Date.parse(x.at) < 15 * 60_000).map((x) => x.teamId)).size;
  const byType = db.types.map((ty) => ({ ty, n: s.filter((x) => db.challenges.find((c) => c.id === x.challengeId)?.typeId === ty.id).length }));
  const maxType = Math.max(1, ...byType.map((x) => x.n));
  const name = (id: string) => db.users.find((u) => u.id === id)?.displayName ?? "Unknown";
  const team = (id: string) => db.teams.find((x) => x.id === id)?.name ?? "Unknown team";
  const title = (id: string) => db.challenges.find((c) => c.id === id)?.title ?? "Deleted challenge";
  const act = (fn: () => void, msg: string) => { try { fn(); toast(msg, "ok"); } catch (e) { toast((e as Error).message, "bad"); } };
  const kpis: [string, string | number, string, string][] = [
    ["Teams", db.teams.length, `${players.length} players`, "#1E5B7A"],
    ["Active now", `${active}/${db.teams.length}`, "teams submitting in the last 15 min", "#1F7A5C"],
    ["Solves", s.length, `${accuracy}% of submissions correct`, "#B88A1F"],
    ["Challenges live", live.length, `${scheduled.length} scheduled, ${drafts.length} drafts`, "#8E4B7A"],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-3xl bg-deep p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <BigTimer />
            <div className="flex flex-col gap-2">
              {t.status === "not-started" && <button className="btn btn-brass" onClick={() => { if (confirm(`Start the ${db.settings.durationMinutes / 60}-hour clock now? Flags open immediately.`)) act(() => be.startTimer(), "The clock is running"); }}>Start the {db.settings.durationMinutes / 60}-hour clock</button>}
              {t.status === "live" && <>
                <button className="btn btn-ghost-light btn-sm" onClick={() => act(() => be.extendTimer(10), "Added 10 minutes")}>Add 10 minutes</button>
                <button className="btn btn-ghost-light btn-sm" onClick={() => { if (confirm("End the event now? Submissions close immediately.")) act(() => be.endEventNow(), "Event ended"); }}>End now</button>
              </>}
              {t.status !== "not-started" && <button className="btn btn-ghost-light btn-sm" onClick={() => { if (confirm("Reset the clock? The event goes back to not started.")) act(() => be.resetTimer(), "Clock reset"); }}>Reset clock</button>}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="post" className="btn btn-brass btn-sm">Post a wave of 5</Link>
            <Link to="post?mode=single" className="btn btn-ghost-light btn-sm">Post a single challenge</Link>
            <Link to="notifications" className="btn btn-ghost-light btn-sm">Send a notification</Link>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          {kpis.map(([k, v, sub, col]) => (
            <div key={k} className="panel relative overflow-hidden px-5 py-4">
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: col }} />
              <p className="text-[13px] font-medium text-deep/60">{k}</p>
              <p className="mt-1 font-display text-[30px] font-bold tabular">{v}</p>
              <p className="text-[12.5px] text-deep/60">{sub}</p>
            </div>
          ))}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="panel p-5 xl:col-span-2">
          <h2 className="mb-4 text-[16px] font-semibold">Solves over time</h2>
          <SolvesChart />
        </section>
        <section className="panel p-5">
          <h2 className="mb-4 text-[16px] font-semibold">Solves by type</h2>
          <ul className="space-y-3">
            {byType.map(({ ty, n }) => (
              <li key={ty.id} className="text-[14px]">
                <div className="mb-1 flex justify-between"><span>{ty.name}</span><span className="tabular font-semibold">{n}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-foam"><motion.div className="h-full rounded-full" style={{ background: ty.colour }} initial={{ width: 0 }} animate={{ width: `${(n / maxType) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold">Live feed</h2><Link className="text-[13px] font-semibold text-kelp" to="submissions">All submissions</Link></div>
          {recent.length === 0 ? <p className="text-[14px] text-deep/60">No submissions yet.</p> : (
            <ul className="divide-y divide-fin-200/60">
              <AnimatePresence initial={false}>
                {recent.map((x) => (
                  <motion.li key={x.id} layout initial={{ opacity: 0, backgroundColor: "#FBF0D2" }} animate={{ opacity: 1, backgroundColor: "#ffffff" }} transition={{ duration: 1.2 }}
                    className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-3 py-2.5 text-[14px]">
                    <span className={`h-2.5 w-2.5 rounded-full ${x.correct ? "bg-kelp" : "bg-coral"}`} aria-label={x.correct ? "correct" : "wrong"} />
                    <span className="min-w-0 truncate"><b>{team(x.teamId)}</b> <span className="text-deep/60">({name(x.userId)})</span> {x.correct ? "solved" : "missed"} <b>{title(x.challengeId)}</b></span>
                    <span className="text-[12.5px] text-deep/50 tabular">{ago(x.at, now)}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
        <div className="space-y-6">
          <section className="panel p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold">Leaderboard</h2><Link className="text-[13px] font-semibold text-kelp" to="/scoreboard">Public view</Link></div>
            <ol className="space-y-2">
              {rows.slice(0, 6).map((r) => (
                <li key={r.teamId} className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-2 text-[14px]">
                  <span className={`grid h-6 w-6 place-items-center rounded-full font-display text-[12px] font-bold ${r.rank === 1 && r.score ? "bg-brass text-deep" : "bg-foam text-deep/60"}`}>{r.rank}</span>
                  <span className="truncate font-medium">{r.teamName}</span>
                  <span className="tabular font-semibold">{r.score}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold">Up next</h2><Link className="text-[13px] font-semibold text-kelp" to="library">Library</Link></div>
            {scheduled.length === 0 ? <p className="text-[14px] text-deep/60">Nothing scheduled. Drafts: {drafts.length}.</p> : (
              <ul className="space-y-2 text-[14px]">
                {scheduled.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span className="truncate"><i className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: THEME_INFO[c.theme].ink }} />{c.title}</span>
                    <span className="shrink-0 text-[12.5px] text-deep/60 tabular">{clock(c.releaseAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="panel overflow-x-auto p-5">
        <h2 className="mb-3 text-[16px] font-semibold">Challenge health</h2>
        <table className="w-full min-w-[640px] text-[14px]">
          <thead><tr className="border-b border-fin-200 text-left text-[12.5px] text-deep/60"><th className="py-2 font-medium">Challenge</th><th className="font-medium">Points</th><th className="font-medium">Solved by</th><th className="font-medium">Attempts</th><th className="font-medium">First solve</th></tr></thead>
          <tbody>
            {live.sort((a, b) => a.points - b.points).map((c) => {
              const n = s.filter((x) => x.challengeId === c.id).length;
              const first = s.find((x) => x.challengeId === c.id);
              return (
                <tr key={c.id} className="border-b border-fin-200/50 last:border-0">
                  <td className="py-2.5 font-medium">{c.title}</td>
                  <td className="tabular">{c.points}</td>
                  <td><span className="inline-flex items-center gap-2"><span className="h-1.5 w-20 overflow-hidden rounded-full bg-foam"><span className="block h-full bg-kelp" style={{ width: `${db.teams.length ? (n / db.teams.length) * 100 : 0}%` }} /></span><span className="tabular">{n}/{db.teams.length}</span></span></td>
                  <td className="tabular">{db.submissions.filter((x) => x.challengeId === c.id).length}</td>
                  <td className="text-deep/70">{first ? `${team(first.teamId)} at ${clock(first.at)}` : "Not yet"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
