import { useState } from "react";
import { Modal, useToast } from "../../components/ui";
import type { Credential } from "../../data/backend";
import { useBackend, useDB, useNow } from "../../data/store";
import type { NoticeLevel } from "../../data/types";
import { ago, downloadText, toCSV } from "../../lib/format";
import { PageHead } from "./Admin";

export function NotificationsAdmin() {
  const be = useBackend();
  const db = useDB();
  const now = useNow(10000);
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<NoticeLevel>("info");
  return (
    <div className="max-w-3xl">
      <PageHead title="Notifications">Messages appear on every player's Notifications page, pop up while they play, and show as an unread badge.</PageHead>
      <form className="panel space-y-4 p-5" onSubmit={(e) => {
        e.preventDefault();
        try { be.postNotification(title, body, level); setTitle(""); setBody(""); setLevel("info"); toast("Notification sent", "ok"); }
        catch (err) { toast((err as Error).message, "bad"); }
      }}>
        <div><label className="label" htmlFor="nt">Title</label><input id="nt" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Wave 2 drops in 10 minutes" /></div>
        <div><label className="label" htmlFor="nb">Message</label><textarea id="nb" className="field h-24" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details for the teams" /></div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <fieldset className="flex gap-2"><legend className="sr-only">Importance</legend>
            {(["info", "important"] as const).map((l) => (
              <label key={l} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[14px] font-medium ${level === l ? (l === "important" ? "border-coral bg-coral text-white" : "border-deep bg-deep text-white") : "border-fin-200 bg-white"}`}>
                <input type="radio" className="sr-only" checked={level === l} onChange={() => setLevel(l)} />{l === "info" ? "Update" : "Important"}
              </label>
            ))}
          </fieldset>
          <button className="btn btn-kelp" disabled={!title.trim() && !body.trim()}>Send notification</button>
        </div>
      </form>
      <h2 className="mb-3 mt-8 text-[17px] font-semibold">Sent</h2>
      <ul className="space-y-2">
        {db.notifications.map((n) => (
          <li key={n.id} className={`panel flex items-start justify-between gap-4 px-5 py-3.5 text-[14.5px] ${n.level === "important" ? "border-coral/40" : ""}`}>
            <span><span className="text-[12.5px] text-deep/55">{ago(n.at, now)}{n.level === "important" && ", important"}</span><br /><b>{n.title}</b> {n.body}</span>
            <button className="btn btn-danger btn-sm" onClick={() => be.deleteNotification(n.id)}>Delete</button>
          </li>
        ))}
        {db.notifications.length === 0 && <li className="text-[14px] text-deep/60">Nothing sent yet.</li>}
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
  const byValue = new Map<string, Set<string>>();
  for (const s of db.submissions.filter((x) => !x.correct)) {
    const k = `${s.challengeId}:${s.value.toLowerCase()}`;
    if (!byValue.has(k)) byValue.set(k, new Set());
    byValue.get(k)!.add(s.teamId);
  }
  const shared = new Set([...byValue].filter(([, v]) => v.size > 1).map(([k]) => k));
  return (
    <div>
      <PageHead title="Submissions" actions={<button className="btn btn-line" onClick={() => downloadText("ecocypher-submissions.csv", toCSV([["time", "team", "member", "challenge", "submitted", "correct"], ...list.map((s) => [s.at, teams.get(s.teamId) ?? "", users.get(s.userId)?.displayName ?? "", chs.get(s.challengeId) ?? "", s.value, String(s.correct)])]), "text/csv")}>Export CSV</button>}>
        Every flag submitted, newest first. Correct flags are never stored as typed. Wrong answers typed by more than one team are marked for review.
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
            {list.slice(0, 400).map((s) => (
              <tr key={s.id} className="border-b border-fin-200/50 last:border-0">
                <td className="whitespace-nowrap px-5 py-2.5 text-deep/60">{ago(s.at, now)}</td>
                <td>{teams.get(s.teamId) ?? "Deleted team"}</td>
                <td>{users.get(s.userId)?.displayName ?? "Removed member"}</td>
                <td>{chs.get(s.challengeId) ?? "Deleted challenge"}</td>
                <td className="max-w-[16rem] truncate font-mono text-[13px]">{s.value}</td>
                <td className="pr-5">{s.correct ? <span className="chip bg-kelp-100 text-kelp-600">Correct</span> : <span className="chip bg-coral-100 text-coral">Wrong</span>}
                  {!s.correct && shared.has(`${s.challengeId}:${s.value.toLowerCase()}`) && <span className="chip ml-1 bg-brass-100 text-brass-600">Shared answer</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="px-5 py-8 text-center text-[14px] text-deep/60">No submissions match these filters.</p>}
      </div>
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
    <div className="max-w-3xl space-y-6">
      <PageHead title="Settings" />
      <form className="panel grid gap-4 p-6 sm:grid-cols-2" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        be.updateSettings({
          eventName: String(fd.get("eventName")).trim() || "EcoCypher",
          tagline: String(fd.get("tagline")).trim() || s.tagline,
          durationMinutes: Math.max(10, Number(fd.get("dur")) || 180),
          teamSize: Math.min(8, Math.max(1, Number(fd.get("size")) || 3)),
          submissionsPerMinute: Math.max(1, Number(fd.get("spm")) || 10),
        });
        toast("Settings saved", "ok");
      }}>
        <h2 className="text-[17px] font-semibold sm:col-span-2">Event</h2>
        <div><label className="label" htmlFor="en">Event name</label><input id="en" name="eventName" className="field" defaultValue={s.eventName} /></div>
        <div><label className="label" htmlFor="dur">Clock length (minutes)</label><input id="dur" name="dur" type="number" min={10} className="field" defaultValue={s.durationMinutes} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="tl">Homepage headline</label><input id="tl" name="tagline" className="field" defaultValue={s.tagline} /></div>
        <div><label className="label" htmlFor="size">Members per team</label><input id="size" name="size" type="number" min={1} max={8} className="field" defaultValue={s.teamSize} /></div>
        <div><label className="label" htmlFor="spm">Flag attempts per member per minute</label><input id="spm" name="spm" type="number" min={1} className="field" defaultValue={s.submissionsPerMinute} /></div>
        <button className="btn btn-kelp justify-self-start">Save settings</button>
        <p className="text-[13px] text-deep/60 sm:col-span-2">Start, extend and end the clock from the dashboard.</p>
      </form>

      <section className="panel p-6">
        <h2 className="text-[17px] font-semibold">Challenge types</h2>
        <p className="mt-1 text-[14px] text-deep/70">Rename your four challenge types and pick their colours.</p>
        <ul className="mt-4 space-y-3">
          {db.types.map((t, i) => (
            <li key={t.id}>
              <form className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_4rem_auto]" onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                be.updateType(t.id, { name: String(fd.get("name")).trim() || t.name, description: String(fd.get("description")), colour: String(fd.get("colour")) });
                toast(`Saved type ${i + 1}`, "ok");
              }}>
                <div><label className="label" htmlFor={`tn${i}`}>Type {i + 1}</label><input id={`tn${i}`} name="name" className="field" defaultValue={t.name} /></div>
                <div><label className="label" htmlFor={`td${i}`}>Description</label><input id={`td${i}`} name="description" className="field" defaultValue={t.description} /></div>
                <div><label className="label" htmlFor={`tc${i}`}>Colour</label><input id={`tc${i}`} name="colour" type="color" className="h-[46px] w-full cursor-pointer rounded-xl border border-fin-200" defaultValue={t.colour} /></div>
                <button className="btn btn-line">Save</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-6">
        <h2 className="text-[17px] font-semibold">Scoreboard</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-line" onClick={() => { be.updateSettings({ scoreboardVisible: !s.scoreboardVisible }); toast(s.scoreboardVisible ? "Scoreboard hidden from players" : "Scoreboard visible", "ok"); }}>
            {s.scoreboardVisible ? "Hide scoreboard from players" : "Show scoreboard to players"}</button>
          {s.freezeAt
            ? <button className="btn btn-line" onClick={() => { be.updateSettings({ freezeAt: null }); toast("Scoreboard unfrozen", "ok"); }}>Unfreeze scoreboard</button>
            : <button className="btn btn-line" onClick={() => { be.updateSettings({ freezeAt: new Date().toISOString() }); toast("Scoreboard frozen for players", "ok"); }}>Freeze scoreboard now</button>}
        </div>
        <p className="mt-2 text-[13px] text-deep/60">Freezing keeps the last stretch a surprise until the reveal. Admins always see live scores.</p>
      </section>

      <section className="panel p-6">
        <h2 className="text-[17px] font-semibold">Data and security</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] text-deep/75">
          <li>Flags and passwords are stored only as salted PBKDF2 hashes. Nobody, including admins, can read a flag back.</li>
          <li>Everything saved in this browser is encrypted with AES-256 using a key the browser won't let anyone export.</li>
          <li>This GitHub Pages version keeps data in this browser only. Export a backup before clearing browser data.</li>
        </ul>
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
        <p className="text-[14.5px]">This deletes every team, challenge, wave, notification and submission in this browser, including the demo data, and creates a new admin login. Export a backup first if you might need it.</p>
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
