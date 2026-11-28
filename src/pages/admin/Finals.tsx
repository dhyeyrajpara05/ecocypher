import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, Modal, useRun } from "../../components/ui";
import { defaultFinals, finalStandings } from "../../data/scoring";
import { useBackend, useDB } from "../../data/store";
import type { Judge } from "../../data/types";
import { dateTime } from "../../lib/format";
import { PageHead } from "./Admin";

type Draft = Record<string, Record<string, string>>;
const toDraft = (s: Record<string, Record<string, number>>): Draft =>
  Object.fromEntries(Object.entries(s).map(([t, m]) => [t, Object.fromEntries(Object.entries(m).map(([j, v]) => [j, String(v)]))]));
const fromDraft = (d: Draft) => {
  const out: Record<string, Record<string, number>> = {};
  for (const [t, m] of Object.entries(d)) for (const [j, v] of Object.entries(m)) if (v.trim() !== "" && Number.isFinite(Number(v))) (out[t] ??= {})[j] = Number(v);
  return out;
};

/** Admin: Shark Tank judging, weighting, and publishing the final results page. */
export default function Finals() {
  const be = useBackend();
  const db = useDB();
  const run = useRun();
  const f = db.finals ?? defaultFinals();
  const [weight, setWeight] = useState(f.ctfWeight);
  const [max, setMax] = useState(String(f.pitchMax));
  const [judges, setJudges] = useState<Judge[]>(f.judges);
  const [draft, setDraft] = useState<Draft>(() => toDraft(f.scores));
  const [confirm, setConfirm] = useState(false);
  // Pick up changes saved elsewhere (another admin tab), unless there are unsaved edits here.
  const savedKey = JSON.stringify([f.ctfWeight, f.pitchMax, f.judges, f.scores]);
  const [lastSaved, setLastSaved] = useState(savedKey);
  const dirtySettings = weight !== f.ctfWeight || Number(max) !== f.pitchMax;
  const dirtyJudges = JSON.stringify(judges) !== JSON.stringify(f.judges);
  const dirtyScores = JSON.stringify(fromDraft(draft)) !== JSON.stringify(f.scores);
  useEffect(() => {
    if (savedKey === lastSaved) return;
    setLastSaved(savedKey);
    if (!dirtySettings) { setWeight(f.ctfWeight); setMax(String(f.pitchMax)); }
    if (!dirtyJudges) setJudges(f.judges);
    if (!dirtyScores) setDraft(toDraft(f.scores));
  }, [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = useMemo(() => finalStandings(db, { ...f, ctfWeight: weight, pitchMax: Number(max) || f.pitchMax, judges, scores: fromDraft(draft) }), [db, f, weight, max, judges, draft]);
  const published = f.published && f.snapshot;
  const outOfDate = !!published && JSON.stringify(f.snapshot!.map((r) => [r.teamId, r.combined, r.rank])) !== JSON.stringify(finalStandings(db).map((r) => [r.teamId, r.combined, r.rank]));
  const missing = db.teams.filter((t) => judges.some((j) => !(draft[t.id]?.[j.id] ?? "").trim()));
  const setScore = (teamId: string, judgeId: string, v: string) => setDraft((d) => ({ ...d, [teamId]: { ...(d[teamId] ?? {}), [judgeId]: v } }));
  const saveAll = () => run(be.updateFinals({ ctfWeight: weight, pitchMax: Number(max), judges, scores: fromDraft(draft) }), "Final results saved");
  const anyDirty = dirtySettings || dirtyJudges || dirtyScores;

  return (
    <div>
      <PageHead title="Final results" actions={<Link className="btn btn-line" to="/results">{published ? "Open the results page" : "Preview the results page"}</Link>}>
        Enter the judges' Shark Tank scores, choose how much the CTF and the pitch count, then publish. Players see nothing until you publish.
      </PageHead>

      {/* publish status */}
      <section className={`panel mb-6 flex flex-wrap items-center gap-4 p-5 ${published ? "border-kelp/50" : ""}`}>
        <span className={`chip ${published ? "bg-kelp-100 text-kelp-600" : "bg-fin-200/50 text-fin"}`}>{published ? "Published" : "Not published"}</span>
        <p className="min-w-[14rem] flex-1 text-[14px] text-deep/75">
          {published
            ? <>Players see the results as they were on {dateTime(f.publishedAt)}. {outOfDate && <b className="text-brass-600">Scores have changed since then: update to show the new standings.</b>}</>
            : "Publishing freezes the current standings, shows a Results link to everyone and sends a notification."}
        </p>
        {anyDirty && <span className="text-[13px] font-semibold text-coral">Save your changes first</span>}
        {published ? (
          <>
            <button className="btn btn-kelp" disabled={anyDirty} onClick={() => run(be.publishFinals(true), "Published results updated")}>Update published results</button>
            <button className="btn btn-line" onClick={() => run(be.publishFinals(false), "Results hidden from players")}>Unpublish</button>
          </>
        ) : (
          <button className="btn btn-kelp" disabled={anyDirty || !db.teams.length} onClick={() => setConfirm(true)}>Publish results</button>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        {/* weighting + judges */}
        <section className="panel space-y-5 p-5">
          <div>
            <h2 className="text-[17px] font-semibold">Weighting</h2>
            <label className="mt-3 block text-[14px]" htmlFor="fw">CTF <b>{weight}%</b> · Shark Tank pitch <b>{100 - weight}%</b></label>
            <input id="fw" type="range" min={0} max={100} step={5} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="mt-2 w-full accent-[#1F7A5C]" />
            <p className="mt-1 text-[12.5px] text-deep/60">CTF points are scaled so the top CTF team gets 100; the pitch is the judges' average scaled to 100.</p>
          </div>
          <div>
            <label className="label" htmlFor="fmax">Each judge scores a pitch out of</label>
            <input id="fmax" type="number" min={1} max={1000} className="field w-32" value={max} onChange={(e) => setMax(e.target.value)} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold">Judges</h2>
            <ul className="mt-2 space-y-2">
              {judges.map((j, i) => (
                <li key={j.id || i} className="flex gap-2">
                  <input className="field" aria-label={`Judge ${i + 1} name`} value={j.name} placeholder={`Judge ${i + 1}`} onChange={(e) => setJudges(judges.map((x, k) => k === i ? { ...x, name: e.target.value } : x))} />
                  <button type="button" className="btn btn-line btn-sm" onClick={() => { if (confirm_(`Remove ${j.name || "this judge"} and their scores?`)) setJudges(judges.filter((_, k) => k !== i)); }}>Remove</button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-line btn-sm mt-2" onClick={() => setJudges([...judges, { id: `j-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`, name: "" }])}>Add a judge</button>
          </div>
        </section>

        {/* score grid */}
        <section className="panel p-5">
          <h2 className="text-[17px] font-semibold">Pitch scores</h2>
          {!db.teams.length ? <Empty title="No teams yet">Teams appear here once they're created.</Empty>
            : !judges.length ? <p className="mt-2 text-[14px] text-deep/65">Add at least one judge to enter pitch scores.</p>
            : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead><tr className="text-left text-[12.5px] text-deep/60">
                    <th className="py-1.5 pr-3 font-semibold">Team</th>
                    {judges.map((j, i) => <th key={j.id} className="px-1 py-1.5 font-semibold">{j.name || `Judge ${i + 1}`}</th>)}
                    <th className="py-1.5 pl-2 text-right font-semibold">Average</th>
                  </tr></thead>
                  <tbody>
                    {db.teams.map((t) => {
                      const vals = judges.map((j) => draft[t.id]?.[j.id] ?? "").filter((v) => v.trim() !== "").map(Number);
                      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                      return (
                        <tr key={t.id} className="border-t border-fin-200/60">
                          <td className="max-w-[10rem] truncate py-1.5 pr-3 font-medium">{t.name}</td>
                          {judges.map((j, i) => (
                            <td key={j.id} className="px-1 py-1.5">
                              <input type="number" inputMode="decimal" min={0} max={Number(max) || undefined} step="0.5" className="field w-20 px-2 py-1.5 text-center"
                                aria-label={`${j.name || `Judge ${i + 1}`} score for ${t.name}`} value={draft[t.id]?.[j.id] ?? ""} onChange={(e) => setScore(t.id, j.id, e.target.value)} />
                            </td>
                          ))}
                          <td className="py-1.5 pl-2 text-right tabular">{avg === null ? "–" : avg.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          {judges.length > 0 && missing.length > 0 && <p className="mt-2 text-[12.5px] text-deep/60">{missing.length} team{missing.length === 1 ? "" : "s"} still missing a judge's score. A team's pitch is the average of the scores it has; a team with none gets 0 for the pitch.</p>}
        </section>
      </div>

      <div className="sticky bottom-3 z-10 mt-5 flex justify-end">
        <button className="btn btn-kelp shadow-lg" disabled={!anyDirty} onClick={() => void saveAll()}>{anyDirty ? "Save changes" : "All changes saved"}</button>
      </div>

      {/* live standings */}
      <section className="panel mt-6 p-5">
        <h2 className="text-[17px] font-semibold">Standings with these numbers</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead><tr className="text-left text-[12.5px] text-deep/60">
              <th className="py-1.5 pr-3">#</th><th className="py-1.5 pr-3">Team</th><th className="py-1.5 pr-3 text-right">CTF points</th><th className="py-1.5 pr-3 text-right">CTF /100</th>
              <th className="py-1.5 pr-3 text-right">Pitch avg</th><th className="py-1.5 pr-3 text-right">Pitch /100</th><th className="py-1.5 text-right">Final /100</th>
            </tr></thead>
            <tbody>
              {live.map((r) => (
                <tr key={r.teamId} className={`border-t border-fin-200/60 ${r.rank <= 3 ? "font-semibold" : ""}`}>
                  <td className="py-1.5 pr-3">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</td>
                  <td className="max-w-[12rem] truncate py-1.5 pr-3">{r.teamName}</td>
                  <td className="py-1.5 pr-3 text-right tabular">{r.ctfScore.toLocaleString("en-IN")}</td>
                  <td className="py-1.5 pr-3 text-right tabular">{r.ctfScaled.toFixed(1)}</td>
                  <td className="py-1.5 pr-3 text-right tabular">{r.pitchAvg ?? "–"}</td>
                  <td className="py-1.5 pr-3 text-right tabular">{r.pitchScaled.toFixed(1)}</td>
                  <td className="py-1.5 text-right tabular text-kelp">{r.combined.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Publish the final results?">
        <p className="text-[14.5px]">Everyone will see the Results page with the standings as they are now, and teams get a notification. You can unpublish, or update it if scores change.</p>
        <ol className="mt-3 space-y-1 text-[14px]">
          {live.slice(0, 3).map((r) => <li key={r.teamId}><b>{["1st", "2nd", "3rd"][r.rank - 1] ?? `${r.rank}th`}</b>: {r.teamName} ({r.combined.toFixed(1)})</li>)}
        </ol>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-line" onClick={() => setConfirm(false)}>Not yet</button>
          <button className="btn btn-kelp" onClick={async () => { setConfirm(false); await run(be.publishFinals(true), "Results published. Teams have been notified."); }}>Publish</button>
        </div>
      </Modal>
    </div>
  );
}

const confirm_ = (msg: string) => window.confirm(msg);
