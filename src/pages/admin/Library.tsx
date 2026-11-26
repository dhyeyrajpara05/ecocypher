import { useState } from "react";
import { Link } from "react-router-dom";
import { THEME_INFO, ThemeArt } from "../../components/themes";
import { Empty, Modal, TypeChip, useToast, useRun } from "../../components/ui";
import type { ChallengeInput } from "../../data/backend";
import { releaseStatus, solveCounts, WAVE_SIZE } from "../../data/scoring";
import { useBackend, useDB, useNow } from "../../data/store";
import type { BulkAction, Challenge, ReleaseStatus } from "../../data/types";
import { dateTime, fromLocalInput, toLocalInput } from "../../lib/format";
import { PageHead } from "./Admin";
import { ChallengeFields } from "./ChallengeFields";

const STATUS: Record<ReleaseStatus, [string, string]> = {
  draft: ["bg-fin-200/50 text-fin", "Draft"],
  scheduled: ["bg-brass-100 text-brass-600", "Scheduled"],
  live: ["bg-kelp-100 text-kelp-600", "Live"],
  archived: ["bg-fin-200/50 text-deep/60", "Archived"],
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
    setV({ typeId: c.typeId, theme: c.theme, title: c.title, description: c.description, points: c.points, flag: "", caseSensitive: c.caseSensitive, files: c.files, hints: c.hints, maxAttempts: c.maxAttempts, cues: c.cues, python: c.python, hidden: c.hidden });
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

/** Picks a release time for every selected challenge at once. */
function BulkScheduleModal({ open, count, onClose, onSave }: { open: boolean; count: number; onClose: () => void; onSave: (iso: string) => void }) {
  const [at, setAt] = useState("");
  return (
    <Modal open={open} onClose={onClose} title={`Schedule ${count} challenge${count === 1 ? "" : "s"}`}>
      <label className="label" htmlFor="bulk-rel">Release at</label>
      <input id="bulk-rel" type="datetime-local" className="field" value={at} onChange={(e) => setAt(e.target.value)} />
      <div className="mt-5 flex justify-end gap-2"><button className="btn btn-line" onClick={onClose}>Cancel</button>
        <button className="btn btn-kelp" disabled={!at} onClick={() => { const iso = fromLocalInput(at); if (iso) onSave(iso); setAt(""); }}>Schedule</button></div>
    </Modal>
  );
}

const plural = (n: number) => `${n} challenge${n === 1 ? "" : "s"}`;

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
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkSchedule, setBulkSchedule] = useState(false);
  const nextWave = Math.max(0, ...db.waves.map((w) => w.number)) + 1;
  const inPlay = db.challenges.filter((c) => !c.archivedAt);
  const archivedCount = db.challenges.length - inPlay.length;
  // Selection only keeps challenges that still exist and aren't archived.
  const sel = picked.filter((id) => inPlay.some((c) => c.id === id));
  const togglePick = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const setMany = (ids: string[], on: boolean) => setPicked((p) => on ? [...new Set([...p, ...ids])] : p.filter((x) => !ids.includes(x)));
  const pickedSingles = sel.filter((id) => !inPlay.find((c) => c.id === id)?.waveId);
  const canMakeWave = sel.length === WAVE_SIZE && pickedSingles.length === WAVE_SIZE;
  const bulk = (action: BulkAction, done: (r: { changed: number; skipped: number }) => string, at?: string) =>
    run(async () => {
      const r = await be.bulkChallenges(action, sel, at);
      toast(done(r) + (r.skipped ? ` (${r.skipped} archived, skipped)` : ""), "ok");
      setPicked([]);
    });
  const groups = [
    ...[...db.waves].sort((a, b) => b.number - a.number).map((w) => ({ key: w.id, title: `Wave ${w.number}`, list: inPlay.filter((c) => c.waveId === w.id) })),
    { key: "single", title: "Single challenges", list: inPlay.filter((c) => !c.waveId) },
  ].map((g) => ({ ...g, list: g.list.filter((c) => filter === "all" || releaseStatus(c, now) === filter) })).filter((g) => g.list.length);

  const shown = groups.flatMap((g) => g.list.map((c) => c.id));
  const allShown = shown.length > 0 && shown.every((id) => sel.includes(id));
  const releaseGroup = (ids: string[]) => run(async () => { const at = new Date().toISOString(); for (const id of ids) await be.setRelease(id, at); }, `${ids.length} challenge${ids.length === 1 ? "" : "s"} now live`);

  return (
    <div>
      <PageHead title="Challenge library" actions={<><Link className="btn btn-kelp" to="../post">Post a wave</Link><Link className="btn btn-line" to="../post?mode=single">Post a single challenge</Link></>}>
        Every challenge in play. Release drafts, reschedule, edit, hide or archive. Tick challenges to act on many at once.
        {archivedCount > 0 && <> <Link className="font-semibold text-kelp underline" to="../archive">{archivedCount} archived</Link>.</>}
      </PageHead>
      {!db.settings.startsAt && db.challenges.some((c) => releaseStatus(c, now) === "live") && (
        <p className="mb-5 rounded-2xl border border-brass/40 bg-brass-100/60 px-4 py-3 text-[14px]">
          Some challenges are live, but the <b>event clock hasn't started</b>, so players can read them but can't submit flags or open hints yet.
          Start it from the <Link className="font-semibold text-kelp underline" to="..">Dashboard</Link>.
        </p>
      )}
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {(["all", "live", "scheduled", "draft"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip px-3.5 py-1.5 text-[13px] ${filter === f ? "bg-deep text-white" : "bg-white ring-1 ring-fin-200"}`}>
            {f === "all" ? "All" : STATUS[f][1]} <span className="opacity-60">{f === "all" ? inPlay.length : inPlay.filter((c) => releaseStatus(c, now) === f).length}</span>
          </button>
        ))}
        {shown.length > 0 && (
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-[13.5px]">
            <input type="checkbox" className="h-4 w-4 accent-[#1F7A5C]" checked={allShown} onChange={(e) => setMany(shown, e.target.checked)} />
            Select all shown ({shown.length})
          </label>
        )}
      </div>
      {sel.length > 0 && (
        <div className="sticky top-16 z-10 mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-kelp/40 bg-white/95 px-4 py-3 text-[14px] shadow-sm backdrop-blur" role="toolbar" aria-label="Actions for selected challenges">
          <b className="mr-1 tabular">{sel.length} selected</b>
          <button className="btn btn-kelp btn-sm" onClick={() => bulk("release", (r) => `${plural(r.changed)} now live`)}>Release now</button>
          <button className="btn btn-line btn-sm" onClick={() => setBulkSchedule(true)}>Schedule</button>
          <button className="btn btn-line btn-sm" onClick={() => bulk("unpublish", (r) => `${plural(r.changed)} unpublished`)}>Unpublish</button>
          <button className="btn btn-line btn-sm" onClick={() => bulk("archive", (r) => `${plural(r.changed)} archived`)}>Archive</button>
          <button className="btn btn-line btn-sm" disabled={!canMakeWave} title={canMakeWave ? "" : `Tick exactly ${WAVE_SIZE} single challenges to make a wave`}
            onClick={() => run(be.groupIntoWave(sel), `Wave ${nextWave} created. Its challenges keep their own release status.`).then((ok) => { if (ok) setPicked([]); })}>
            Make Wave {nextWave}
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Delete ${plural(sel.length)} and their submissions? This can't be undone. Archive keeps them instead.`)) void bulk("delete", (r) => `${plural(r.changed)} deleted`); }}>Delete</button>
          <button className="btn btn-line btn-sm ml-auto" onClick={() => setPicked([])}>Clear</button>
        </div>
      )}
      {groups.length === 0 ? <Empty title="Nothing here yet">Post a wave of five or a single challenge to get started.</Empty> : groups.map((g) => {
        const unreleased = g.list.filter((c) => releaseStatus(c, now) !== "live").map((c) => c.id);
        const ids = g.list.map((c) => c.id);
        const allIn = ids.every((id) => sel.includes(id));
        return (
          <section key={g.key} className="mb-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" className="h-5 w-5 accent-[#1F7A5C]" aria-label={`Select every challenge in ${g.title}`} checked={allIn} onChange={(e) => setMany(ids, e.target.checked)} />
                <h2 className="text-[18px] font-bold">{g.title}</h2>
              </label>
              <span className="flex flex-wrap gap-2">
                {g.key !== "single" && unreleased.length > 0 && <button className="btn btn-kelp btn-sm" onClick={() => releaseGroup(unreleased)}>Release this wave now</button>}
                {g.key !== "single" && <button className="btn btn-line btn-sm" onClick={() => { if (confirm(`Split ${g.title}? Its challenges go back to single challenges and keep their release status.`)) void run(be.splitWave(g.key), `${g.title} split into single challenges`); }}>Split wave</button>}
              </span>
            </div>
            {g.key === "single" && <p className="mb-3 text-[13.5px] text-deep/65">To make a wave, tick {WAVE_SIZE} single challenges and press <b>Make Wave {nextWave}</b> in the toolbar.</p>}
            <ul className="space-y-2">
              {g.list.sort((a, b) => g.key === "single" ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : a.points - b.points).map((c) => {
                const st = releaseStatus(c, now);
                return (
                  <li key={c.id} className={`panel flex flex-wrap items-center gap-4 px-4 py-3 ${sel.includes(c.id) ? "ring-2 ring-kelp" : ""}`}>
                    <input type="checkbox" className="h-5 w-5 shrink-0 cursor-pointer accent-[#1F7A5C]" aria-label={`Select ${c.title}`}
                      checked={sel.includes(c.id)} onChange={() => togglePick(c.id)} />
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
                      <button className="btn btn-line btn-sm" title="Take it out of play and off the scoreboard. Restore it any time from Archive." onClick={() => run(be.bulkChallenges("archive", [c.id]), `"${c.title}" archived`)}>Archive</button>
                      <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Delete "${c.title}" and its submissions? Archive keeps them instead.`)) void run(be.deleteChallenge(c.id), "Deleted"); }}>Delete</button>
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
      <BulkScheduleModal open={bulkSchedule} count={sel.length} onClose={() => setBulkSchedule(false)}
        onSave={(iso) => { setBulkSchedule(false); void bulk("schedule", (r) => `${plural(r.changed)} scheduled for ${dateTime(iso)}`, iso); }} />
    </div>
  );
}
