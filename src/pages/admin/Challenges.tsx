import { useState } from "react";
import { Empty, Modal, RoundChip, TypeChip, useToast } from "../../components/ui";
import type { ChallengeInput } from "../../data/backend";
import { roundStatus, solveCounts } from "../../data/scoring";
import { useBackend, useDB, useNow } from "../../data/store";
import type { Challenge } from "../../data/types";
import { PageHead } from "./Admin";

function Editor({ editing, onClose }: { editing: Challenge | "new" | null; onClose: () => void }) {
  const be = useBackend();
  const db = useDB();
  const toast = useToast();
  const existing = editing && editing !== "new" ? editing : null;
  const blank: ChallengeInput = { roundId: db.rounds[0]?.id ?? "", typeId: db.types[0].id, title: "", description: "", points: 100, flag: "", caseSensitive: false, files: [], hint: "", hidden: false };
  const [f, setF] = useState<ChallengeInput>(blank);
  const [seen, setSeen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const key = editing === "new" ? "new" : existing?.id ?? null;
  if (key !== seen) {
    setSeen(key); setError("");
    setF(existing ? { roundId: existing.roundId, typeId: existing.typeId, title: existing.title, description: existing.description, points: existing.points, flag: "", caseSensitive: existing.caseSensitive, files: existing.files, hint: existing.hint, hidden: existing.hidden } : blank);
  }
  const set = <K extends keyof ChallengeInput>(k: K, v: ChallengeInput[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try {
      await be.saveChallenge(existing?.id ?? null, { ...f, files: f.files.filter((x) => x.name.trim() && x.url.trim()) });
      toast(existing ? "Challenge saved" : "Challenge created", "ok");
      onClose();
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <Modal open={!!editing} onClose={onClose} title={existing ? `Edit ${existing.title}` : "New challenge"} wide>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label" htmlFor="t">Title</label><input id="t" className="field" value={f.title} onChange={(e) => set("title", e.target.value)} required /></div>
        <div><label className="label" htmlFor="r">Funding round</label>
          <select id="r" className="field" value={f.roundId} onChange={(e) => set("roundId", e.target.value)}>{db.rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div><label className="label" htmlFor="ty">Type</label>
          <select id="ty" className="field" value={f.typeId} onChange={(e) => set("typeId", e.target.value)}>{db.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
        <div><label className="label" htmlFor="p">Points</label><input id="p" type="number" min={1} className="field" value={f.points} onChange={(e) => set("points", Number(e.target.value))} required /></div>
        <div><label className="label" htmlFor="fl">Flag</label><input id="fl" className="field font-mono" value={f.flag} onChange={(e) => set("flag", e.target.value)} placeholder={existing ? "Leave empty to keep the current flag" : "ECO{...}"} autoComplete="off" />
          <label className="mt-1.5 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={f.caseSensitive} onChange={(e) => set("caseSensitive", e.target.checked)} />Case-sensitive</label></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="d">Description</label><textarea id="d" className="field h-36" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="The story and the task. Line breaks are kept." /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="h">Hint (optional, free to view)</label><input id="h" className="field" value={f.hint} onChange={(e) => set("hint", e.target.value)} /></div>
        <div className="sm:col-span-2">
          <p className="label">Files (links)</p>
          {f.files.map((x, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input className="field w-1/3" placeholder="Name" value={x.name} onChange={(e) => set("files", f.files.map((y, j) => j === i ? { ...y, name: e.target.value } : y))} aria-label="File name" />
              <input className="field" placeholder="https://…" value={x.url} onChange={(e) => set("files", f.files.map((y, j) => j === i ? { ...y, url: e.target.value } : y))} aria-label="File URL" />
              <button type="button" className="btn btn-line btn-sm" onClick={() => set("files", f.files.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-line btn-sm" onClick={() => set("files", [...f.files, { name: "", url: "" }])}>Add a file link</button>
          <p className="mt-1 text-[12.5px] text-deep/60">Host files in the repo's <code className="font-mono">public/files</code> folder or on a drive, and paste the link.</p>
        </div>
        <label className="flex items-center gap-2 text-[14px] sm:col-span-2"><input type="checkbox" checked={f.hidden} onChange={(e) => set("hidden", e.target.checked)} />Hide from players even when the round is open</label>
        {error && <p role="alert" className="rounded-xl bg-coral-100 px-3.5 py-2.5 text-[14px] text-coral sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn btn-line" onClick={onClose}>Cancel</button><button className="btn btn-kelp">{existing ? "Save changes" : "Create challenge"}</button></div>
      </form>
    </Modal>
  );
}

export default function Challenges() {
  const be = useBackend();
  const db = useDB();
  const now = useNow(5000);
  const toast = useToast();
  const [editing, setEditing] = useState<Challenge | "new" | null>(null);
  const [round, setRound] = useState("all");
  const [type, setType] = useState("all");
  const counts = solveCounts(db);
  const list = db.challenges.filter((c) => (round === "all" || c.roundId === round) && (type === "all" || c.typeId === type));
  const rounds = [...db.rounds].sort((a, b) => a.order - b.order);

  return (
    <div>
      <PageHead title="Challenges" actions={<button className="btn btn-kelp" onClick={() => setEditing("new")} disabled={!db.rounds.length}>New challenge</button>}>
        Add challenges one at a time here, or upload a whole wave from Funding rounds.
      </PageHead>
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="field w-auto" value={round} onChange={(e) => setRound(e.target.value)} aria-label="Filter by round"><option value="all">All rounds</option>{rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <select className="field w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type"><option value="all">All types</option>{db.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      </div>
      {list.length === 0 ? <Empty title="No challenges here yet">Create one, or upload a wave into a round.</Empty> : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead><tr className="border-b border-fin-200 text-left text-[12.5px] text-deep/60"><th className="px-5 py-3 font-medium">Title</th><th className="font-medium">Type</th><th className="font-medium">Round</th><th className="font-medium">Points</th><th className="font-medium">Solves</th><th /></tr></thead>
            <tbody>
              {rounds.flatMap((r) => list.filter((c) => c.roundId === r.id).sort((a, b) => a.points - b.points)).map((c) => {
                const r = db.rounds.find((x) => x.id === c.roundId)!;
                return (
                  <tr key={c.id} className="border-b border-fin-200/50 last:border-0">
                    <td className="px-5 py-3 font-medium">{c.title}{c.hidden && <span className="ml-2 text-[12px] font-normal text-fin">hidden</span>}</td>
                    <td><TypeChip type={db.types.find((t) => t.id === c.typeId)} /></td>
                    <td><span className="flex items-center gap-2">{r.name}<RoundChip status={roundStatus(r, now)} /></span></td>
                    <td className="tabular">{c.points}</td>
                    <td className="tabular">{counts.get(c.id) ?? 0}</td>
                    <td className="whitespace-nowrap pr-5 text-right">
                      <button className="btn btn-line btn-sm" onClick={() => setEditing(c)}>Edit</button>{" "}
                      <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Delete "${c.title}" and its submissions?`)) { be.deleteChallenge(c.id); toast("Challenge deleted"); } }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Editor editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
