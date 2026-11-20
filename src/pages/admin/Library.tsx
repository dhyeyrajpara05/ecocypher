import { useState } from "react";
import { Link } from "react-router-dom";
import { THEME_INFO, ThemeArt } from "../../components/themes";
import { Empty, Modal, TypeChip, useToast, useRun } from "../../components/ui";
import type { ChallengeInput } from "../../data/backend";
import { releaseStatus, solveCounts } from "../../data/scoring";
import { useBackend, useDB, useNow } from "../../data/store";
import type { Challenge, ReleaseStatus } from "../../data/types";
import { dateTime, fromLocalInput, toLocalInput } from "../../lib/format";
import { PageHead } from "./Admin";
import { ChallengeFields } from "./ChallengeFields";

const STATUS: Record<ReleaseStatus, [string, string]> = {
  draft: ["bg-fin-200/50 text-fin", "Draft"],
  scheduled: ["bg-brass-100 text-brass-600", "Scheduled"],
  live: ["bg-kelp-100 text-kelp-600", "Live"],
};

function EditModal({ c, onClose }: { c: Challenge | null; onClose: () => void }) {
  const be = useBackend();
  const toast = useToast();
  const run = useRun();
  const [v, setV] = useState<ChallengeInput | null>(null);
  const [seen, setSeen] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (c && seen !== c.id) {
    setSeen(c.id); setError("");
    setV({ typeId: c.typeId, theme: c.theme, title: c.title, description: c.description, points: c.points, flag: "", caseSensitive: c.caseSensitive, files: c.files, hints: c.hints, maxAttempts: c.maxAttempts, hidden: c.hidden });
  }
  return (
    <Modal open={!!c} onClose={() => { setSeen(null); onClose(); }} title={`Edit ${c?.title ?? ""}`} wide>
      {v && c && (
        <form onSubmit={async (e) => { e.preventDefault(); try { await be.saveChallenge(c.id, v); toast("Challenge saved", "ok"); setSeen(null); onClose(); } catch (err) { setError((err as Error).message); } }}>
          <ChallengeFields idPrefix="edit" value={v} onChange={setV} editing />
          {error && <p role="alert" className="mt-4 rounded-xl bg-coral-100 px-3.5 py-2.5 text-[14px] text-coral">{error}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn btn-line" onClick={onClose}>Cancel</button><button className="btn btn-kelp">Save changes</button></div>
        </form>
      )}
    </Modal>
  );
}

function ScheduleModal({ c, onClose }: { c: Challenge | null; onClose: () => void }) {
  const be = useBackend();
  const toast = useToast();
  const run = useRun();
  const [at, setAt] = useState("");
  const [seen, setSeen] = useState<string | null>(null);
  if (c && seen !== c.id) { setSeen(c.id); setAt(toLocalInput(c.releaseAt)); }
  return (
    <Modal open={!!c} onClose={() => { setSeen(null); onClose(); }} title={`Schedule ${c?.title ?? ""}`}>
      <label className="label" htmlFor="rel">Release at</label>
      <input id="rel" type="datetime-local" className="field" value={at} onChange={(e) => setAt(e.target.value)} />
      <div className="mt-5 flex justify-end gap-2"><button className="btn btn-line" onClick={onClose}>Cancel</button>
        <button className="btn btn-kelp" disabled={!at} onClick={() => { if (c) void run(be.setRelease(c.id, fromLocalInput(at)), "Scheduled"); setSeen(null); onClose(); }}>Save</button></div>
    </Modal>
  );
}

export default function Library() {
  const be = useBackend();
  const db = useDB();
  const now = useNow(5000);
  const toast = useToast();
  const run = useRun();
  const counts = solveCounts(db);
  const opens = (id: string) => db.hintUnlocks.filter((h) => h.challengeId === id).length;
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [scheduling, setScheduling] = useState<Challenge | null>(null);
  const [filter, setFilter] = useState<"all" | ReleaseStatus>("all");
  const groups = [
    ...[...db.waves].sort((a, b) => b.number - a.number).map((w) => ({ key: w.id, title: `Wave ${w.number}`, list: db.challenges.filter((c) => c.waveId === w.id) })),
    { key: "single", title: "Single challenges", list: db.challenges.filter((c) => !c.waveId) },
  ].map((g) => ({ ...g, list: g.list.filter((c) => filter === "all" || releaseStatus(c, now) === filter) })).filter((g) => g.list.length);

  const releaseGroup = (ids: string[]) => run(async () => { const at = new Date().toISOString(); for (const id of ids) await be.setRelease(id, at); }, `${ids.length} challenge${ids.length === 1 ? "" : "s"} now live`);

  return (
    <div>
      <PageHead title="Challenge library" actions={<><Link className="btn btn-kelp" to="../post">Post a wave</Link><Link className="btn btn-line" to="../post?mode=single">Post a single challenge</Link></>}>
        Every challenge you've posted. Release drafts, reschedule, edit, hide or delete.
      </PageHead>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {(["all", "live", "scheduled", "draft"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip px-3.5 py-1.5 text-[13px] ${filter === f ? "bg-deep text-white" : "bg-white ring-1 ring-fin-200"}`}>
            {f === "all" ? "All" : STATUS[f][1]} <span className="opacity-60">{f === "all" ? db.challenges.length : db.challenges.filter((c) => releaseStatus(c, now) === f).length}</span>
          </button>
        ))}
      </div>
      {groups.length === 0 ? <Empty title="Nothing here yet">Post a wave of five or a single challenge to get started.</Empty> : groups.map((g) => {
        const unreleased = g.list.filter((c) => releaseStatus(c, now) !== "live").map((c) => c.id);
        return (
          <section key={g.key} className="mb-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[18px] font-bold">{g.title}</h2>
              {g.key !== "single" && unreleased.length > 0 && <button className="btn btn-kelp btn-sm" onClick={() => releaseGroup(unreleased)}>Release this wave now</button>}
            </div>
            <ul className="space-y-2">
              {g.list.sort((a, b) => a.points - b.points).map((c) => {
                const st = releaseStatus(c, now);
                return (
                  <li key={c.id} className="panel flex flex-wrap items-center gap-4 px-4 py-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: THEME_INFO[c.theme].tint }}><ThemeArt theme={c.theme} size={30} /></span>
                    <span className="min-w-[12rem] flex-1">
                      <span className="block font-semibold">{c.title}{c.hidden && <span className="ml-2 text-[12px] font-normal text-fin">hidden</span>}</span>
                      <span className="flex flex-wrap items-center gap-2 text-[13px] text-deep/60"><TypeChip type={db.types.find((t) => t.id === c.typeId)} />{c.points} points, {counts.get(c.id) ?? 0} solves,
                        {" "}{c.maxAttempts ? `${c.maxAttempts} attempts` : "unlimited attempts"}{c.hints.length ? `, ${c.hints.length} hint${c.hints.length === 1 ? "" : "s"} (${opens(c.id)} opened)` : ""}</span>
                    </span>
                    <span className="text-right text-[13px]">
                      <span className={`chip ${STATUS[st][0]}`}>{STATUS[st][1]}</span>
                      {st === "scheduled" && <span className="block pt-0.5 text-deep/60">{dateTime(c.releaseAt)}</span>}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {st !== "live" && <button className="btn btn-kelp btn-sm" onClick={() => run(be.setRelease(c.id, new Date().toISOString()), `"${c.title}" is live`)}>Release now</button>}
                      <button className="btn btn-line btn-sm" onClick={() => setScheduling(c)}>Schedule</button>
                      {st !== "draft" && <button className="btn btn-line btn-sm" onClick={() => run(be.setRelease(c.id, null), `"${c.title}" unpublished`)}>Unpublish</button>}
                      {c.maxAttempts > 0 && <button className="btn btn-line btn-sm" title="Give every team 3 more attempts" onClick={() => run(be.addAttempts(c.id, 3), `"${c.title}" now allows ${c.maxAttempts + 3} attempts`)}>+3 attempts</button>}
                      <button className="btn btn-line btn-sm" onClick={() => setEditing(c)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Delete "${c.title}" and its submissions?`)) void run(be.deleteChallenge(c.id), "Deleted"); }}>Delete</button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <EditModal c={editing} onClose={() => setEditing(null)} />
      <ScheduleModal c={scheduling} onClose={() => setScheduling(null)} />
    </div>
  );
}
