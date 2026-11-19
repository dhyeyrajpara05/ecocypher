import { useState } from "react";
import { Empty, Modal, useToast } from "../../components/ui";
import type { Credential } from "../../data/backend";
import { scoreboard } from "../../data/scoring";
import { useBackend, useDB } from "../../data/store";
import { downloadText, toCSV } from "../../lib/format";
import { PageHead } from "./Admin";

function CredentialSheet({ creds, onClose }: { creds: Credential[] | null; onClose: () => void }) {
  return (
    <Modal open={!!creds} onClose={onClose} title="Login details" wide>
      <p className="text-[14.5px] text-deep/75">These temporary passwords are shown <b>only once</b>. Download or print them now. Each member picks their own password at first login.</p>
      <div className="mt-4 max-h-80 overflow-y-auto rounded-2xl border border-fin-200">
        <table className="w-full text-[14px]">
          <thead className="sticky top-0 bg-foam"><tr className="text-left text-[12.5px] text-deep/60"><th className="px-4 py-2 font-medium">Team</th><th className="font-medium">Member</th><th className="font-medium">Username</th><th className="font-medium">Temporary password</th></tr></thead>
          <tbody>{creds?.map((c) => <tr key={c.username} className="border-t border-fin-200/60"><td className="px-4 py-2">{c.team}</td><td>{c.displayName}</td><td className="font-mono">{c.username}</td><td className="font-mono">{c.password}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn btn-line" onClick={() => window.print()}>Print</button>
        <button className="btn btn-kelp" onClick={() => downloadText("ecocypher-logins.csv", toCSV([["team", "member", "username", "temporary_password"], ...(creds ?? []).map((c) => [c.team, c.displayName, c.username, c.password])]), "text/csv")}>Download CSV</button>
      </div>
    </Modal>
  );
}

export default function Teams() {
  const be = useBackend();
  const db = useDB();
  const toast = useToast();
  const [name, setName] = useState("");
  const [members, setMembers] = useState("");
  const [creds, setCreds] = useState<Credential[] | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const rows = scoreboard(db);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const c = await be.createTeam(name, members.split("\n"));
      setCreds(c); setName(""); setMembers("");
    } catch (err) { toast((err as Error).message, "bad"); }
  }

  return (
    <div>
      <PageHead title="Teams & members" actions={<button className="btn btn-line" onClick={() => setCsvOpen(true)}>Import teams from CSV</button>}>
        Every member gets their own login. Points they score count towards their team.
      </PageHead>
      <form onSubmit={create} className="panel mb-8 grid gap-4 p-5 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <div><label className="label" htmlFor="tn">Team name</label><input id="tn" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kelp Capital" required /></div>
        <div><label className="label" htmlFor="tm">Members, one per line</label><textarea id="tm" className="field h-[88px]" value={members} onChange={(e) => setMembers(e.target.value)} placeholder={"Aarav Shah\nMeera Iyer\nKabir Rao"} required /></div>
        <button className="btn btn-kelp">Create team</button>
      </form>

      {db.teams.length === 0 ? <Empty title="No teams yet">Create a team above, or import them all from a CSV.</Empty> : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {db.teams.map((t) => {
            const r = rows.find((x) => x.teamId === t.id);
            const users = db.users.filter((u) => u.teamId === t.id);
            return (
              <li key={t.id} className="panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <input className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 font-display text-[17px] font-semibold hover:border-fin-200 focus:border-kelp focus:outline-none"
                    defaultValue={t.name} aria-label="Team name" onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.name) { try { be.renameTeam(t.id, v); toast("Team renamed", "ok"); } catch (err) { toast((err as Error).message, "bad"); } } }} />
                  <span className="text-right text-[13px] text-deep/60"><b className="font-display text-[18px] text-deep">{r?.score ?? 0}</b> pts<br />rank {r?.rank ?? "-"}</span>
                </div>
                <table className="mt-3 w-full text-[14px]">
                  <tbody>
                    {users.map((u) => {
                      const m = r?.members.find((x) => x.userId === u.id);
                      return (
                        <tr key={u.id} className="border-t border-fin-200/60">
                          <td className="py-2">{u.displayName}<span className="block font-mono text-[12px] text-deep/55">{u.username}{u.mustChangePassword && " (temporary password)"}</span></td>
                          <td className="tabular text-right">{m?.points ?? 0} pts</td>
                          <td className="whitespace-nowrap pl-3 text-right">
                            <button className="btn btn-line btn-sm" onClick={async () => setCreds([await be.resetPassword(u.id)])}>Reset password</button>{" "}
                            <button className="btn btn-danger btn-sm" aria-label={`Remove ${u.displayName}`} onClick={() => { if (confirm(`Remove ${u.displayName}? Their solves stay with the team.`)) be.deleteUser(u.id); }}>Remove</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn btn-line btn-sm" onClick={async () => { const n = prompt("New member's name"); if (n?.trim()) setCreds([await be.addMember(t.id, n)]); }}>Add member</button>
                  <button className="btn btn-danger btn-sm ml-auto" onClick={() => { if (confirm(`Delete ${t.name}, its members and all its submissions?`)) { be.deleteTeam(t.id); toast("Team deleted"); } }}>Delete team</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={csvOpen} onClose={() => { setCsvOpen(false); setCsvErrors([]); }} title="Import teams from CSV" wide>
        <p className="text-[14.5px] text-deep/75">One team per row: <code className="font-mono">team,member1,member2,member3</code>. A header row is optional. Teams can have more or fewer than three members.</p>
        <label className="btn btn-line btn-sm mt-4 cursor-pointer">Choose a file<input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} /></label>
        <textarea className="field mt-3 h-44 font-mono text-[13px]" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"team,member1,member2,member3\nKelp Capital,Aarav Shah,Meera Iyer,Kabir Rao"} aria-label="Teams CSV" />
        {csvErrors.length > 0 && <ul className="mt-3 list-disc rounded-xl bg-brass-100 py-3 pl-8 pr-4 text-[14px]">{csvErrors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-line" onClick={() => setCsvOpen(false)}>Cancel</button>
          <button className="btn btn-kelp" disabled={!csv.trim()} onClick={async () => {
            const r = await be.importTeams(csv);
            setCsvErrors(r.errors);
            if (r.credentials.length) { setCreds(r.credentials); setCsv(""); if (!r.errors.length) setCsvOpen(false); }
          }}>Import teams</button>
        </div>
      </Modal>
      <CredentialSheet creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}
