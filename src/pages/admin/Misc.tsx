import { useState } from "react";
import { Modal, useToast } from "../../components/ui";
import type { Credential } from "../../data/backend";
import { useBackend, useDB, useNow } from "../../data/store";
import { ago, downloadText, fromLocalInput, toCSV, toLocalInput } from "../../lib/format";
import { PageHead } from "./Admin";

export function Types() {
  const be = useBackend();
  const db = useDB();
  const toast = useToast();
  return (
    <div>
      <PageHead title="Challenge types">EcoCypher has four challenge types. Rename them and pick their colours once your team settles on the final four. Existing challenges keep their type.</PageHead>
      <ul className="grid gap-4 md:grid-cols-2">
        {db.types.map((t, i) => (
          <li key={t.id} className="panel p-5" style={{ borderLeft: `5px solid ${t.colour}` }}>
            <p className="text-[12.5px] font-medium text-deep/55">Type {i + 1}, used by {db.challenges.filter((c) => c.typeId === t.id).length} challenges</p>
            <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_5rem]" onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              be.updateType(t.id, { name: String(fd.get("name")).trim() || t.name, colour: String(fd.get("colour")), description: String(fd.get("description")) });
              toast(`Saved ${fd.get("name")}`, "ok");
            }}>
              <div><label className="label" htmlFor={`n${t.id}`}>Name</label><input id={`n${t.id}`} name="name" className="field" defaultValue={t.name} /></div>
              <div><label className="label" htmlFor={`c${t.id}`}>Colour</label><input id={`c${t.id}`} name="colour" type="color" className="h-[46px] w-full cursor-pointer rounded-xl border border-fin-200" defaultValue={t.colour} /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor={`d${t.id}`}>Short description (shown on the homepage)</label><input id={`d${t.id}`} name="description" className="field" defaultValue={t.description} /></div>
              <button className="btn btn-kelp btn-sm justify-self-start">Save type</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Submissions() {
  const db = useDB();
  const now = useNow(5000);
  const [team, setTeam] = useState("all");
  const [ch, setCh] = useState("all");
  const [result, setResult] = useState("all");
  const users = new Map(db.users.map((u) => [u.id, u]));
  const teams = new Map(db.teams.map((t) => [t.id, t.name]));
  const chs = new Map(db.challenges.map((c) => [c.id, c.title]));
  const list = [...db.submissions].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .filter((s) => (team === "all" || s.teamId === team) && (ch === "all" || s.challengeId === ch) && (result === "all" || String(s.correct) === result));
  // Same wrong value submitted by two different teams is worth a look (possible flag sharing).
  const shared = new Set<string>();
  const byValue = new Map<string, Set<string>>();
  for (const s of db.submissions.filter((x) => !x.correct)) {
    const k = `${s.challengeId}:${s.value.toLowerCase()}`;
    if (!byValue.has(k)) byValue.set(k, new Set());
    byValue.get(k)!.add(s.teamId);
  }
  byValue.forEach((v, k) => v.size > 1 && shared.add(k));
  return (
    <div>
      <PageHead title="Submissions" actions={<button className="btn btn-line" onClick={() => downloadText("ecocypher-submissions.csv", toCSV([["time", "team", "member", "challenge", "value", "correct"], ...list.map((s) => [s.at, teams.get(s.teamId) ?? "", users.get(s.userId)?.displayName ?? "", chs.get(s.challengeId) ?? "", s.value, String(s.correct)])]), "text/csv")}>Export CSV</button>}>
        Every flag submitted, newest first. Wrong answers that more than one team typed are marked for review.
      </PageHead>
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="field w-auto" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team"><option value="all">All teams</option>{db.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select className="field w-auto" value={ch} onChange={(e) => setCh(e.target.value)} aria-label="Challenge"><option value="all">All challenges</option>{db.challenges.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        <select className="field w-auto" value={result} onChange={(e) => setResult(e.target.value)} aria-label="Result"><option value="all">Right and wrong</option><option value="true">Correct only</option><option value="false">Wrong only</option></select>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-[14px]">
          <thead><tr className="border-b border-fin-200 text-left text-[12.5px] text-deep/60"><th className="px-5 py-3 font-medium">When</th><th className="font-medium">Team</th><th className="font-medium">Member</th><th className="font-medium">Challenge</th><th className="font-medium">Submitted</th><th className="pr-5 font-medium">Result</th></tr></thead>
          <tbody>
            {list.slice(0, 400).map((s) => {
              const flagged = !s.correct && shared.has(`${s.challengeId}:${s.value.toLowerCase()}`);
              return (
                <tr key={s.id} className="border-b border-fin-200/50 last:border-0">
                  <td className="whitespace-nowrap px-5 py-2.5 text-deep/60">{ago(s.at, now)}</td>
                  <td>{teams.get(s.teamId) ?? "Deleted team"}</td>
                  <td>{users.get(s.userId)?.displayName ?? "Removed member"}</td>
                  <td>{chs.get(s.challengeId) ?? "Deleted challenge"}</td>
                  <td className="max-w-[16rem] truncate font-mono text-[13px]">{s.value}</td>
                  <td className="pr-5">{s.correct ? <span className="chip bg-kelp-100 text-kelp-600">Correct</span> : <span className="chip bg-coral-100 text-coral">Wrong</span>}{flagged && <span className="chip ml-1 bg-brass-100 text-brass-600">Shared answer</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <p className="px-5 py-8 text-center text-[14px] text-deep/60">No submissions match these filters.</p>}
      </div>
    </div>
  );
}

export function Announcements() {
  const be = useBackend();
  const db = useDB();
  const now = useNow(10000);
  const [text, setText] = useState("");
  return (
    <div>
      <PageHead title="Announcements">The newest announcement shows at the top of every player's challenge page.</PageHead>
      <form className="mb-6 flex max-w-2xl gap-2" onSubmit={(e) => { e.preventDefault(); be.postAnnouncement(text); setText(""); }}>
        <label htmlFor="an" className="sr-only">Announcement</label>
        <input id="an" className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Series B opens in 10 minutes." />
        <button className="btn btn-kelp shrink-0" disabled={!text.trim()}>Post</button>
      </form>
      <ul className="max-w-2xl space-y-2">
        {db.announcements.map((a) => (
          <li key={a.id} className="panel flex items-start justify-between gap-4 px-5 py-3.5 text-[14.5px]">
            <span><span className="text-[12.5px] text-deep/55">{ago(a.at, now)}</span><br />{a.text}</span>
            <button className="btn btn-danger btn-sm" onClick={() => be.deleteAnnouncement(a.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Settings() {
  const be = useBackend();
  const db = useDB();
  const toast = useToast();
  const s = db.settings;
  const [fresh, setFresh] = useState<Credential | null>(null);
  const [confirmFresh, setConfirmFresh] = useState(false);
  return (
    <div className="max-w-3xl">
      <PageHead title="Settings" />
      <form className="panel grid gap-4 p-6 sm:grid-cols-2" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        be.updateSettings({
          eventName: String(fd.get("eventName")).trim() || "EcoCypher",
          tagline: String(fd.get("tagline")).trim() || s.tagline,
          startsAt: fromLocalInput(String(fd.get("startsAt"))),
          endsAt: fromLocalInput(String(fd.get("endsAt"))),
          submissionsPerMinute: Math.max(1, Number(fd.get("spm")) || 10),
        });
        toast("Settings saved", "ok");
      }}>
        <h2 className="text-[17px] font-semibold sm:col-span-2">Event</h2>
        <div><label className="label" htmlFor="en">Event name</label><input id="en" name="eventName" className="field" defaultValue={s.eventName} /></div>
        <div><label className="label" htmlFor="spm">Flag attempts per member per minute</label><input id="spm" name="spm" type="number" min={1} className="field" defaultValue={s.submissionsPerMinute} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="tl">Homepage headline</label><input id="tl" name="tagline" className="field" defaultValue={s.tagline} /></div>
        <div><label className="label" htmlFor="sa">Starts</label><input id="sa" name="startsAt" type="datetime-local" className="field" defaultValue={toLocalInput(s.startsAt)} /></div>
        <div><label className="label" htmlFor="ea">Ends (submissions close)</label><input id="ea" name="endsAt" type="datetime-local" className="field" defaultValue={toLocalInput(s.endsAt)} /></div>
        <button className="btn btn-kelp justify-self-start">Save event settings</button>
      </form>

      <section className="panel mt-6 p-6">
        <h2 className="text-[17px] font-semibold">Scoreboard</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-line" onClick={() => { be.updateSettings({ scoreboardVisible: !s.scoreboardVisible }); toast(s.scoreboardVisible ? "Scoreboard hidden from players" : "Scoreboard visible", "ok"); }}>
            {s.scoreboardVisible ? "Hide scoreboard from players" : "Show scoreboard to players"}</button>
          {s.freezeAt
            ? <button className="btn btn-line" onClick={() => { be.updateSettings({ freezeAt: null }); toast("Scoreboard unfrozen", "ok"); }}>Unfreeze scoreboard</button>
            : <button className="btn btn-line" onClick={() => { be.updateSettings({ freezeAt: new Date().toISOString() }); toast("Scoreboard frozen. Players see standings from now; you still see live scores.", "ok"); }}>Freeze scoreboard now</button>}
        </div>
        <p className="mt-2 text-[13px] text-deep/60">Freezing keeps the final stretch a surprise until the reveal. Admins always see live scores.</p>
      </section>

      <section className="panel mt-6 p-6">
        <h2 className="text-[17px] font-semibold">Data</h2>
        <p className="mt-1 text-[14px] text-deep/70">This GitHub Pages version stores everything in this browser. Export a backup before clearing browser data, and import it on another computer to move the event.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-line" onClick={() => downloadText(`ecocypher-backup-${new Date().toISOString().slice(0, 10)}.json`, be.exportJSON(), "application/json")}>Export backup</button>
          <label className="btn btn-line cursor-pointer">Import backup<input type="file" accept=".json,application/json" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            if (!confirm("Replace all current data with this backup?")) return;
            try { be.importJSON(await f.text()); toast("Backup imported", "ok"); } catch (err) { toast((err as Error).message, "bad"); }
          }} /></label>
          <button className="btn btn-danger" onClick={() => setConfirmFresh(true)}>Clear everything and start fresh</button>
        </div>
      </section>

      <Modal open={confirmFresh} onClose={() => setConfirmFresh(false)} title="Start fresh?">
        <p className="text-[14.5px]">This deletes every team, challenge, round and submission in this browser, including the demo data, and creates a new admin login. Export a backup first if you might need it.</p>
        <div className="mt-5 flex justify-end gap-2"><button className="btn btn-line" onClick={() => setConfirmFresh(false)}>Keep my data</button>
          <button className="btn btn-danger" onClick={async () => { setConfirmFresh(false); setFresh(await be.startFresh()); }}>Delete and start fresh</button></div>
      </Modal>
      <Modal open={!!fresh} onClose={() => setFresh(null)} title="Your new admin login">
        <p className="text-[14.5px]">Write this down. You'll be asked to change the password next time you log in.</p>
        <p className="mt-4 rounded-2xl bg-foam p-4 font-mono text-[15px]">username: {fresh?.username}<br />password: {fresh?.password}</p>
        <div className="mt-5 flex justify-end"><button className="btn btn-kelp" onClick={() => setFresh(null)}>I've saved it</button></div>
      </Modal>
    </div>
  );
}
