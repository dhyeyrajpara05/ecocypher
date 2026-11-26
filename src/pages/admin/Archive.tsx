import { useState } from "react";
import { Link } from "react-router-dom";
import { THEME_INFO, ThemeArt } from "../../components/themes";
import { Empty, TypeChip, useRun, useToast } from "../../components/ui";
import { solveCounts } from "../../data/scoring";
import { useBackend, useDB } from "../../data/store";
import type { BulkAction } from "../../data/types";
import { dateTime } from "../../lib/format";
import { PageHead } from "./Admin";

const plural = (n: number) => `${n} challenge${n === 1 ? "" : "s"}`;

/** Archived challenges: out of play and off the scoreboard, but kept. Restore puts them back exactly as they were. */
export default function Archive() {
  const be = useBackend();
  const db = useDB();
  const run = useRun();
  const toast = useToast();
  const counts = solveCounts(db);
  const list = db.challenges.filter((c) => c.archivedAt).sort((a, b) => Date.parse(b.archivedAt!) - Date.parse(a.archivedAt!));
  const [picked, setPicked] = useState<string[]>([]);
  const sel = picked.filter((id) => list.some((c) => c.id === id));
  const all = list.length > 0 && list.every((c) => sel.includes(c.id));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const act = (action: BulkAction, ids: string[], done: string) =>
    run(async () => { await be.bulkChallenges(action, ids); toast(done, "ok"); setPicked((p) => p.filter((x) => !ids.includes(x))); });

  return (
    <div>
      <PageHead title="Archive" actions={<Link className="btn btn-line" to="../library">Back to the library</Link>}>
        Archived challenges are hidden from players and their points stop counting on the scoreboard, but nothing is deleted.
        Restore one and it comes back exactly as it was, with its solves counting again.
      </PageHead>
      {list.length === 0 ? (
        <Empty title="Nothing archived">Archive a challenge from the library to take it out of play without deleting it.</Empty>
      ) : (
        <>
          <div className="sticky top-16 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-fin-200 bg-white/95 px-4 py-3 text-[14px] shadow-sm backdrop-blur">
            <label className="mr-2 flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[#1F7A5C]" checked={all} onChange={(e) => setPicked(e.target.checked ? list.map((c) => c.id) : [])} />
              {sel.length ? <b className="tabular">{sel.length} selected</b> : `Select all (${list.length})`}
            </label>
            <button className="btn btn-kelp btn-sm" disabled={!sel.length} onClick={() => act("restore", sel, `${plural(sel.length)} restored`)}>Restore</button>
            <button className="btn btn-danger btn-sm" disabled={!sel.length}
              onClick={() => { if (confirm(`Delete ${plural(sel.length)} permanently, with their submissions? This can't be undone.`)) void act("delete", sel, `${plural(sel.length)} deleted`); }}>
              Delete permanently
            </button>
          </div>
          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.id} className={`panel flex flex-wrap items-center gap-4 px-4 py-3 ${sel.includes(c.id) ? "ring-2 ring-kelp" : ""}`}>
                <input type="checkbox" className="h-5 w-5 shrink-0 cursor-pointer accent-[#1F7A5C]" aria-label={`Select ${c.title}`} checked={sel.includes(c.id)} onChange={() => toggle(c.id)} />
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl opacity-70" style={{ background: THEME_INFO[c.theme].tint }}><ThemeArt theme={c.theme} size={30} /></span>
                <span className="min-w-[12rem] flex-1">
                  <span className="block font-semibold">{c.title}</span>
                  <span className="flex flex-wrap items-center gap-2 text-[13px] text-deep/60">
                    <TypeChip type={db.types.find((t) => t.id === c.typeId)} />
                    {c.points} points, {counts.get(c.id) ?? 0} solves (not counting), archived {dateTime(c.archivedAt!)}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  <button className="btn btn-kelp btn-sm" onClick={() => act("restore", [c.id], `"${c.title}" restored`)}>Restore</button>
                  <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Delete "${c.title}" permanently, with its submissions?`)) void act("delete", [c.id], "Deleted"); }}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
