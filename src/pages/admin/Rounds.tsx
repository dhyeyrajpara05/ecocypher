import { useState } from "react";
import { Modal, RoundChip, useToast } from "../../components/ui";
import { roundStatus } from "../../data/scoring";
import { useBackend, useDB, useNow } from "../../data/store";
import type { Round } from "../../data/types";
import { downloadText, fromLocalInput, toLocalInput } from "../../lib/format";
import { PageHead } from "./Admin";

const TEMPLATE_CSV = `title,type,points,flag,description,hint,files
"Bin Day",OSINT,100,ECO{example-flag},"Which photo was taken at the loading dock?","Photos remember more than they show",photos.zip|https://example.com/photos.zip
"Twin Invoices",Data & SQL,150,ECO{another-flag},"Find the haulier that billed twice.",,
`;

export function ImportWave({ round, onClose }: { round: Round | null; onClose: () => void }) {
  const be = useBackend();
  const toast = useToast();
  const [text, setText] = useState("");
  const [report, setReport] = useState<{ added: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");
  async function run() {
    if (!round) return;
    setError(""); setReport(null);
    try {
      const r = await be.importChallenges(round.id, text);
      setReport(r);
      if (r.added) toast(`${r.added} challenge${r.added === 1 ? "" : "s"} added to ${round.name}`, "ok");
      if (!r.errors.length) { setText(""); onClose(); }
    } catch (e) { setError((e as Error).message); }
  }
  return (
    <Modal open={!!round} onClose={() => { setReport(null); setError(""); onClose(); }} title={`Upload a wave into ${round?.name ?? ""}`} wide>
      <p className="text-[14.5px] text-deep/75">Paste or load a CSV or JSON file. Each row becomes a challenge in this round. Flags are hashed as they're saved and never stored in plain text.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <label className="btn btn-line btn-sm cursor-pointer">Choose a file
          <input type="file" accept=".csv,.json,text/csv,application/json" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
        </label>
        <button className="btn btn-line btn-sm" onClick={() => downloadText("ecocypher-wave-template.csv", TEMPLATE_CSV, "text/csv")}>Download CSV template</button>
      </div>
      <textarea className="field mt-4 h-56 font-mono text-[13px]" value={text} onChange={(e) => setText(e.target.value)}
        placeholder={'title,type,points,flag,description,hint,files\n"Bin Day",OSINT,100,ECO{...},"...",,'} aria-label="Wave data" />
      <p className="mt-2 text-[12.5px] text-deep/60">Columns: title, type (one of your four type names), points, flag, description, hint, files (<code className="font-mono">name|url;name|url</code>). JSON: an array of objects with the same keys.</p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-coral-100 px-3.5 py-2.5 text-[14px] text-coral">{error}</p>}
      {report && report.errors.length > 0 && (
        <div className="mt-3 rounded-xl bg-brass-100 px-4 py-3 text-[14px]">
          <p className="font-semibold">{report.added} added. {report.errors.length} row{report.errors.length === 1 ? "" : "s"} skipped:</p>
          <ul className="mt-1 list-disc pl-5">{report.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2"><button className="btn btn-line" onClick={onClose}>Cancel</button><button className="btn btn-kelp" disabled={!text.trim()} onClick={run}>Upload wave</button></div>
    </Modal>
  );
}

function ScheduleModal({ round, onClose }: { round: Round | null; onClose: () => void }) {
  const be = useBackend();
  const toast = useToast();
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const [seenId, setSeenId] = useState<string | null>(null);
  if (round && seenId !== round.id) { setSeenId(round.id); setOpens(toLocalInput(round.opensAt)); setCloses(toLocalInput(round.closesAt)); }
  return (
    <Modal open={!!round} onClose={() => { setSeenId(null); onClose(); }} title={`Schedule ${round?.name ?? ""}`}>
      <div className="space-y-4">
        <div><label className="label" htmlFor="o">Opens at</label><input id="o" type="datetime-local" className="field" value={opens} onChange={(e) => setOpens(e.target.value)} /></div>
        <div><label className="label" htmlFor="c">Closes at (optional)</label><input id="c" type="datetime-local" className="field" value={closes} onChange={(e) => setCloses(e.target.value)} />
          <p className="mt-1 text-[12.5px] text-deep/60">Leave empty to keep the round open until the event ends.</p></div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-line" onClick={onClose}>Cancel</button>
          <button className="btn btn-kelp" disabled={!opens} onClick={() => {
            if (!round) return;
            be.updateRound(round.id, { state: "scheduled", opensAt: fromLocalInput(opens), closesAt: fromLocalInput(closes) });
            toast(`${round.name} scheduled`, "ok"); setSeenId(null); onClose();
          }}>Save schedule</button>
        </div>
      </div>
    </Modal>
  );
}

export default function Rounds() {
  const be = useBackend();
  const db = useDB();
  const now = useNow(1000);
  const toast = useToast();
  const [name, setName] = useState("");
  const [importInto, setImportInto] = useState<Round | null>(null);
  const [scheduling, setScheduling] = useState<Round | null>(null);
  const rounds = [...db.rounds].sort((a, b) => a.order - b.order);
  const act = (fn: () => void, msg: string) => { try { fn(); toast(msg, "ok"); } catch (e) { toast((e as Error).message, "bad"); } };

  return (
    <div>
      <PageHead title="Funding rounds">Each round is a wave of challenges. Upload a wave into a round while it's a draft, then open it now or schedule it. Players only see challenges once their round opens.</PageHead>
      <form className="mb-6 flex max-w-lg gap-2" onSubmit={(e) => { e.preventDefault(); act(() => be.createRound(name), `Round "${name || "New round"}" created`); setName(""); }}>
        <label htmlFor="rn" className="sr-only">Round name</label>
        <input id="rn" className="field" placeholder="New round name, e.g. Series C" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-kelp shrink-0">Add round</button>
      </form>
      <ol className="space-y-3">
        {rounds.map((r, i) => {
          const st = roundStatus(r, now);
          const count = db.challenges.filter((c) => c.roundId === r.id).length;
          const pts = db.challenges.filter((c) => c.roundId === r.id).reduce((a, c) => a + c.points, 0);
          return (
            <li key={r.id} className="panel p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-display text-[13px] font-bold text-fin">{i + 1}</span>
                <input className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 font-display text-[18px] font-semibold hover:border-fin-200 focus:border-kelp focus:outline-none"
                  defaultValue={r.name} aria-label="Round name" onBlur={(e) => e.target.value.trim() && e.target.value !== r.name && be.updateRound(r.id, { name: e.target.value.trim() })} />
                <RoundChip status={st} />
              </div>
              <p className="mt-2 text-[14px] text-deep/70">
                {count} challenge{count === 1 ? "" : "s"}, {pts} points in total.{" "}
                {st === "upcoming" && r.opensAt && <>Opens {new Date(r.opensAt).toLocaleString()}.</>}
                {st === "open" && r.closesAt && <>Closes {new Date(r.closesAt).toLocaleString()}.</>}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-line btn-sm" onClick={() => setImportInto(r)}>Upload wave</button>
                {st !== "open" && <button className="btn btn-kelp btn-sm" onClick={() => act(() => be.updateRound(r.id, { state: "scheduled", opensAt: new Date().toISOString(), closesAt: null }), `${r.name} is open`)}>Open now</button>}
                <button className="btn btn-line btn-sm" onClick={() => setScheduling(r)}>Schedule</button>
                {st === "open" && <button className="btn btn-line btn-sm" onClick={() => act(() => be.updateRound(r.id, { state: "closed" }), `${r.name} closed`)}>Close now</button>}
                {st !== "draft" && <button className="btn btn-line btn-sm" onClick={() => act(() => be.updateRound(r.id, { state: "draft", opensAt: null, closesAt: null }), `${r.name} moved back to draft`)}>Back to draft</button>}
                {i > 0 && <button className="btn btn-line btn-sm" aria-label={`Move ${r.name} up`} onClick={() => { const prev = rounds[i - 1]; be.updateRound(r.id, { order: prev.order }); be.updateRound(prev.id, { order: r.order }); }}>Move up</button>}
                <button className="btn btn-danger btn-sm ml-auto" onClick={() => { if (confirm(`Delete ${r.name}?`)) act(() => be.deleteRound(r.id), `${r.name} deleted`); }}>Delete</button>
              </div>
            </li>
          );
        })}
      </ol>
      <ImportWave round={importInto} onClose={() => setImportInto(null)} />
      <ScheduleModal round={scheduling} onClose={() => setScheduling(null)} />
    </div>
  );
}
