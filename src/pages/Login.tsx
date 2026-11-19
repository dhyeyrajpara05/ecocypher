import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Footer } from "../components/chrome";
import { Tank } from "../components/Tank";
import { Logo } from "../components/ui";
import { DEMO_ADMIN, DEMO_PLAYER_PASSWORD } from "../data/seed";
import { useBackend, useDB } from "../data/store";
import type { User } from "../data/types";

export default function Login() {
  const be = useBackend();
  const db = useDB();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<"team" | "admin">("team");
  const [teamId, setTeamId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const team = db.teams.find((t) => t.id === teamId);
  const members = db.users.filter((u) => u.teamId === teamId && u.role === "player");
  const member = members.find((m) => m.id === memberId);

  function done(u: User) {
    if (u.mustChangePassword) nav("/password");
    else nav(loc.state?.from ?? (u.role === "admin" ? "/admin" : "/play"));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      done(mode === "team" ? await be.loginMember(teamId, memberId, password) : await be.login(username, password));
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  const switchMode = (m: "team" | "admin") => { setMode(m); setError(""); setPassword(""); };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="grid flex-1 md:grid-cols-[.9fr_1.1fr]">
        <div className="relative hidden overflow-hidden bg-deep md:block">
          <Tank surface={46} />
          <div className="relative flex h-full flex-col justify-between p-10 text-white">
            <Link to="/"><Logo light /></Link>
            <div>
              <p className="max-w-sm font-display text-[26px] font-semibold leading-snug">Log in as yourself. Play as your startup.</p>
              <p className="mt-3 max-w-sm text-[15px] text-aqua/85">Every member of a team has their own login. Whoever cracks a flag, the points go to the whole team.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center px-6 py-12 sm:px-14">
          <Link to="/" className="mb-10 md:hidden"><Logo /></Link>
          <div className="mb-8 inline-flex w-fit rounded-full bg-white p-1 ring-1 ring-fin-200" role="tablist">
            {(["team", "admin"] as const).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
                className={`rounded-full px-4 py-1.5 text-[14px] font-semibold ${mode === m ? "bg-deep text-white" : "text-deep/70"}`}>
                {m === "team" ? "Team member" : "Organiser"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="max-w-md">
            {mode === "team" ? (
              <>
                <h1 className="text-[28px] font-bold">Log in to your team</h1>
                <p className="mt-2 text-[15px] text-deep/70">Pick your team, then your name, then type the password from your team sheet.</p>
                <fieldset className="mt-7">
                  <legend className="label">1. Your team</legend>
                  {db.teams.length === 0 ? <p className="text-[14px] text-deep/60">No teams are registered yet. Ask an organiser.</p> : (
                    <select className="field" value={teamId} onChange={(e) => { setTeamId(e.target.value); setMemberId(""); setError(""); }} aria-label="Your team" required>
                      <option value="">Choose your team</option>
                      {[...db.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </fieldset>
                <AnimatePresence>
                  {team && (
                    <motion.fieldset key={team.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6">
                      <legend className="label">2. Who are you?</legend>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {members.map((m) => (
                          <button type="button" key={m.id} onClick={() => { setMemberId(m.id); setError(""); }} aria-pressed={memberId === m.id}
                            className={`rounded-2xl border px-3 py-3 text-left text-[14.5px] font-medium transition-colors ${memberId === m.id ? "border-kelp bg-kelp-100 text-kelp-600" : "border-fin-200 bg-white hover:border-deep/30"}`}>
                            <span className="mb-1.5 grid h-8 w-8 place-items-center rounded-full bg-deep font-display text-[13px] text-white">{m.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                            {m.displayName}
                          </button>
                        ))}
                      </div>
                    </motion.fieldset>
                  )}
                </AnimatePresence>
                {member && (
                  <div className="mt-6">
                    <label className="label" htmlFor="p">3. Your password</label>
                    <input id="p" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
                  </div>
                )}
              </>
            ) : (
              <>
                <h1 className="text-[28px] font-bold">Organiser login</h1>
                <p className="mt-2 text-[15px] text-deep/70">For the admin dashboard.</p>
                <div className="mt-7 space-y-4">
                  <div><label className="label" htmlFor="u">Username</label><input id="u" className="field" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
                  <div><label className="label" htmlFor="ap">Password</label><input id="ap" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
                </div>
              </>
            )}
            {error && <p role="alert" className="mt-4 rounded-xl bg-coral-100 px-3.5 py-2.5 text-[14px] text-coral">{error}</p>}
            {(mode === "admin" || member) && (
              <button className="btn btn-kelp mt-6 w-full" disabled={busy}>{busy ? "Checking…" : mode === "team" ? `Log in as ${member!.displayName.split(" ")[0]}` : "Log in"}</button>
            )}
          </form>

          {db.demo && (
            <div className="mt-10 max-w-md rounded-2xl bg-aqua-200 p-4 text-[13.5px] text-deep/80">
              <p className="font-semibold text-deep">Exploring the demo?</p>
              <p className="mt-1">Any demo team member's password is <code className="font-mono">{DEMO_PLAYER_PASSWORD}</code>.</p>
              <p>Organiser: <code className="font-mono">{DEMO_ADMIN.username}</code> / <code className="font-mono">{DEMO_ADMIN.password}</code></p>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
