import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Tank } from "../components/Tank";
import { Logo } from "../components/ui";
import { DEMO_ADMIN, DEMO_PLAYER_PASSWORD } from "../data/seed";
import { useBackend, useDB } from "../data/store";

export default function Login() {
  const be = useBackend();
  const db = useDB();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const u = await be.login(username, password);
      if (u.mustChangePassword) nav("/password");
      else nav(loc.state?.from ?? (u.role === "admin" ? "/admin" : "/play"));
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-deep md:block">
        <Tank surface={46} />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Link to="/"><Logo light /></Link>
          <p className="max-w-sm font-display text-[26px] font-semibold leading-snug">The sharks are listening. Bring them a flag.</p>
        </div>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-14">
        <Link to="/" className="mb-10 md:hidden"><Logo /></Link>
        <h1 className="text-[28px] font-bold">Log in</h1>
        <p className="mt-2 text-[15px] text-deep/70">Use the username and password from your team sheet. Each member has their own login.</p>
        <form onSubmit={submit} className="mt-8 max-w-sm space-y-4">
          <div>
            <label className="label" htmlFor="u">Username</label>
            <input id="u" className="field" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. kelp-capital-2" required />
          </div>
          <div>
            <label className="label" htmlFor="p">Password</label>
            <input id="p" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p role="alert" className="rounded-xl bg-coral-100 px-3.5 py-2.5 text-[14px] text-coral">{error}</p>}
          <button className="btn btn-kelp w-full" disabled={busy}>{busy ? "Checking…" : "Log in"}</button>
        </form>
        {db.demo && (
          <div className="mt-10 max-w-sm rounded-2xl bg-aqua-200 p-4 text-[13.5px] text-deep/80">
            <p className="font-semibold text-deep">Exploring the demo?</p>
            <p className="mt-1">Player: <code className="font-mono">kelp-capital-1</code> / <code className="font-mono">{DEMO_PLAYER_PASSWORD}</code></p>
            <p>Admin: <code className="font-mono">{DEMO_ADMIN.username}</code> / <code className="font-mono">{DEMO_ADMIN.password}</code></p>
            <p className="mt-1 text-deep/60">Demo data lives only in this browser.</p>
          </div>
        )}
      </div>
    </div>
  );
}
