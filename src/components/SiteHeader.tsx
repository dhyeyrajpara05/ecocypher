import { Link, NavLink, useNavigate } from "react-router-dom";
import { useBackend, useDB, useUser } from "../data/store";
import { Logo } from "./ui";

export function SiteHeader({ dark = false }: { dark?: boolean }) {
  const user = useUser();
  const db = useDB();
  const be = useBackend();
  const nav = useNavigate();
  const team = db.teams.find((t) => t.id === user?.teamId);
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${dark ? (isActive ? "bg-white/15 text-white" : "text-aqua/80 hover:text-white") : isActive ? "bg-deep text-white" : "text-deep/70 hover:text-deep"}`;
  return (
    <header className={`relative z-20 ${dark ? "" : "border-b border-fin-200/60 bg-foam/90 backdrop-blur"}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link to="/" aria-label="EcoCypher home"><Logo light={dark} /></Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {user?.role === "player" && <NavLink to="/play" className={link}>Challenges</NavLink>}
          <NavLink to="/scoreboard" className={link}>Scoreboard</NavLink>
          {user?.role === "admin" && <NavLink to="/admin" className={link}>Sharks' Desk</NavLink>}
        </nav>
        {user ? (
          <div className="flex items-center gap-2">
            <span className={`hidden text-right text-[13px] leading-tight sm:block ${dark ? "text-aqua" : "text-deep/70"}`}>
              <b className={dark ? "text-white" : "text-deep"}>{user.displayName}</b><br />{team?.name ?? "Admin"}
            </span>
            <button className={`btn btn-sm ${dark ? "btn-ghost-light" : "btn-line"}`} onClick={() => { be.logout(); nav("/"); }}>Log out</button>
          </div>
        ) : (
          <Link to="/login" className={`btn btn-sm ${dark ? "btn-brass" : "btn-kelp"}`}>Log in</Link>
        )}
      </div>
      {user && (
        <nav className="flex gap-1 overflow-x-auto px-5 pb-3 md:hidden" aria-label="Main mobile">
          {user.role === "player" && <NavLink to="/play" className={link}>Challenges</NavLink>}
          <NavLink to="/scoreboard" className={link}>Scoreboard</NavLink>
          {user.role === "admin" && <NavLink to="/admin" className={link}>Sharks' Desk</NavLink>}
        </nav>
      )}
    </header>
  );
}
