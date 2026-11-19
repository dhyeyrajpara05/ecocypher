import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Logo } from "../components/ui";
import { Footer } from "../components/chrome";
import { useBackend, useUser } from "../data/store";

export default function ChangePassword() {
  const be = useBackend();
  const user = useUser();
  const nav = useNavigate();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  if (!user) return <Navigate to="/login" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== again) return setError("The new passwords don't match.");
    try {
      await be.changePassword(cur, next);
      nav(user!.role === "admin" ? "/admin" : "/play");
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <div className="flex min-h-screen flex-col">
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <Logo />
      <form onSubmit={submit} className="panel mt-8 w-full max-w-sm space-y-4 p-7">
        <h1 className="text-xl font-bold">Choose your own password</h1>
        <p className="text-[14px] text-deep/70">You're logged in with a temporary password. Pick a new one, at least 8 characters.</p>
        <div><label className="label" htmlFor="c">Temporary password</label><input id="c" className="field" type="password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
        <div><label className="label" htmlFor="n">New password</label><input id="n" className="field" type="password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required /></div>
        <div><label className="label" htmlFor="a">New password again</label><input id="a" className="field" type="password" value={again} onChange={(e) => setAgain(e.target.value)} required /></div>
        {error && <p role="alert" className="rounded-xl bg-coral-100 px-3.5 py-2.5 text-[14px] text-coral">{error}</p>}
        <button className="btn btn-kelp w-full">Save password</button>
      </form>
    </div>
    <Footer />
    </div>
  );
}
