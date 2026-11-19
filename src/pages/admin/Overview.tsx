import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { RoundChip } from "../../components/ui";
import { eventStatus, roundStatus, scoreboard, solves } from "../../data/scoring";
import { useDB, useNow } from "../../data/store";
import { ago, clock, countdown } from "../../lib/format";
import { PageHead } from "./Admin";

export default function Overview() {
  const db = useDB();
  const now = useNow(1000);
  const rows = scoreboard(db);
  const players = db.users.filter((u) => u.role === "player");
  const s = solves(db);
  const wrong = db.submissions.filter((x) => !x.correct).length;
  const accuracy = db.submissions.length ? Math.round((db.submissions.filter((x) => x.correct).length / db.submissions.length) * 100) : 0;
  const ev = eventStatus(db, now);
  const recent = [...db.submissions].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 14);
  const lastHour = db.submissions.filter((x) => now.getTime() - Date.parse(x.at) < 3600_000);
  const byChallenge = db.challenges.map((c) => ({
    c, solves: s.filter((x) => x.challengeId === c.id).length,
    first: s.find((x) => x.challengeId === c.id),
    tries: db.submissions.filter((x) => x.challengeId === c.id).length,
  }));
  const name = (id: string) => db.users.find((u) => u.id === id)?.displayName ?? "Unknown";
  const team = (id: string) => db.teams.find((t) => t.id === id)?.name ?? "Unknown team";
  const title = (id: string) => db.challenges.find((c) => c.id === id)?.title ?? "Deleted challenge";
  const stats: [string, string | number, string][] = [
    ["Event", ev === "live" ? "Live" : ev === "before" ? "Not started" : "Ended",
      ev === "live" && db.settings.endsAt ? `${countdown(db.settings.endsAt, now)} left` : ev === "before" && db.settings.startsAt ? `starts in ${countdown(db.settings.startsAt, now)}` : ""],
    ["Teams", db.teams.length, `${players.length} players`],
    ["Solves", s.length, `${lastHour.filter((x) => x.correct).length} in the last hour`],
    ["Wrong flags", wrong, `${accuracy}% of submissions correct`],
  ];

  return (
    <div>
      <PageHead title="Live monitor">Everything happening in the tank, updating as it happens.</PageHead>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map(([k, v, sub]) => (
          <div key={k} className="panel px-5 py-4">
            <p className="text-[13px] font-medium text-deep/60">{k}</p>
            <p className="mt-1 font-display text-[26px] font-bold tabular">{v}</p>
            <p className="text-[13px] text-deep/60">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold">Submission feed</h2><Link className="text-[13px] font-semibold text-kelp" to="../submissions">All submissions</Link></div>
          {recent.length === 0 ? <p className="text-[14px] text-deep/60">No submissions yet.</p> : (
            <ul className="divide-y divide-fin-200/60">
              <AnimatePresence initial={false}>
                {recent.map((x) => (
                  <motion.li key={x.id} layout initial={{ opacity: 0, backgroundColor: "#FBF0D2" }} animate={{ opacity: 1, backgroundColor: "#ffffff" }} transition={{ duration: 1.2 }}
                    className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-3 py-2.5 text-[14px]">
                    <span className={`h-2.5 w-2.5 rounded-full ${x.correct ? "bg-kelp" : "bg-coral"}`} aria-label={x.correct ? "correct" : "wrong"} />
                    <span className="min-w-0 truncate"><b>{team(x.teamId)}</b> <span className="text-deep/60">({name(x.userId)})</span> {x.correct ? "solved" : "missed"} <b>{title(x.challengeId)}</b>
                      {!x.correct && <code className="ml-2 font-mono text-[12.5px] text-coral">{x.value}</code>}</span>
                    <span className="text-[12.5px] text-deep/50 tabular">{ago(x.at, now)}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="panel p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold">Standings</h2><Link className="text-[13px] font-semibold text-kelp" to="/scoreboard">Public scoreboard</Link></div>
            <ol className="space-y-1.5">
              {rows.slice(0, 6).map((r) => (
                <li key={r.teamId} className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-2 text-[14px]">
                  <span className="font-display font-bold text-deep/50">{r.rank}</span>
                  <span className="truncate font-medium">{r.teamName}</span>
                  <span className="tabular font-semibold">{r.score}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="panel p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-semibold">Rounds</h2><Link className="text-[13px] font-semibold text-kelp" to="../rounds">Manage</Link></div>
            <ul className="space-y-2">
              {[...db.rounds].sort((a, b) => a.order - b.order).map((r) => {
                const st = roundStatus(r, now);
                return <li key={r.id} className="flex items-center justify-between gap-2 text-[14px]"><span className="font-medium">{r.name}</span>
                  <span className="flex items-center gap-2 text-[12.5px] text-deep/60">{st === "upcoming" && r.opensAt && <span className="tabular">in {countdown(r.opensAt, now)}</span>}<RoundChip status={st} /></span></li>;
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="panel mt-6 overflow-x-auto p-5">
        <h2 className="mb-3 text-[16px] font-semibold">Challenge health</h2>
        <table className="w-full min-w-[640px] text-[14px]">
          <thead><tr className="border-b border-fin-200 text-left text-[12.5px] text-deep/60"><th className="py-2 font-medium">Challenge</th><th className="font-medium">Points</th><th className="font-medium">Solved by</th><th className="font-medium">Attempts</th><th className="font-medium">First solve</th></tr></thead>
          <tbody>
            {byChallenge.sort((a, b) => a.c.points - b.c.points).map(({ c, solves: n, first, tries }) => (
              <tr key={c.id} className="border-b border-fin-200/50">
                <td className="py-2.5 font-medium">{c.title}{c.hidden && <span className="ml-2 text-[12px] text-fin">hidden</span>}</td>
                <td className="tabular">{c.points}</td>
                <td><span className="inline-flex items-center gap-2"><span className="h-1.5 w-20 overflow-hidden rounded-full bg-foam"><span className="block h-full bg-kelp" style={{ width: `${db.teams.length ? (n / db.teams.length) * 100 : 0}%` }} /></span><span className="tabular">{n}/{db.teams.length}</span></span></td>
                <td className="tabular">{tries}</td>
                <td className="text-deep/70">{first ? `${team(first.teamId)} at ${clock(first.at)}` : "Not yet"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
