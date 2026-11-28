import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useBackend, useDB, useUser } from "../data/store";
import { TimerPill } from "./chrome";
import { Logo, useToast } from "./ui";

const seenKey = (uid: string | undefined) => `ecocypher:seen:${uid ?? "guest"}`;

export function useUnread() {
  const db = useDB();
  const user = useUser();
  const [seen, setSeen] = useState(() => Number(localStorage.getItem(seenKey(user?.id)) ?? 0));
  useEffect(() => {
    const sync = () => setSeen(Number(localStorage.getItem(seenKey(user?.id)) ?? 0));
    sync();
    window.addEventListener("ecocypher:seen", sync);
    return () => window.removeEventListener("ecocypher:seen", sync);
  }, [user?.id]);
  const unread = db.notifications.filter((n) => Date.parse(n.at) > seen).length;
  const markRead = () => { localStorage.setItem(seenKey(user?.id), String(Date.now())); window.dispatchEvent(new Event("ecocypher:seen")); };
  return { unread, markRead };
}

export function SiteHeader({ dark = false }: { dark?: boolean }) {
  const user = useUser();
  const db = useDB();
  const be = useBackend();
  const nav = useNavigate();
  const toast = useToast();
  const { unread } = useUnread();
  const team = db.teams.find((t) => t.id === user?.teamId);
  const latest = db.notifications[0];
  const lastId = useRef(latest?.id);
  useEffect(() => {
    if (latest && lastId.current && latest.id !== lastId.current && user?.role === "player") toast(`New notification: ${latest.title || latest.body}`, "info");
    lastId.current = latest?.id;
  }, [latest, toast, user?.role]);

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${dark ? (isActive ? "bg-white/15 text-white" : "text-aqua/80 hover:text-white") : isActive ? "bg-deep text-white" : "text-deep/70 hover:text-deep"}`;
  const links = (
    <>
      {user?.role === "player" && <NavLink to="/play" className={link}>Challenges</NavLink>}
      {(db.finals?.published || user?.role === "admin") && (
        <NavLink to="/results" className={(a) => `${link(a)} ${db.finals?.published && !a.isActive ? (dark ? "text-brass" : "text-brass-600") : ""}`}>
          <span className="inline-flex items-center gap-1.5">{db.finals?.published && <span aria-hidden="true">🏆</span>}Results</span>
        </NavLink>
      )}
      <NavLink to="/scoreboard" className={link}>Scoreboard</NavLink>
      <NavLink to="/notifications" className={link}>
        <span className="inline-flex items-center gap-1.5">Notifications
          {unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white" aria-label={`${unread} unread`}>{unread}</span>}
        </span>
      </NavLink>
      <NavLink to="/faq" className={link}>FAQ &amp; guidelines</NavLink>
      {user?.role === "admin" && <NavLink to="/admin" className={link}>Admin dashboard</NavLink>}
    </>
  );
  return (
    <header className={`relative z-20 ${dark ? "" : "border-b border-fin-200/60 bg-foam/90 backdrop-blur"}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link to="/" aria-label="EcoCypher home"><Logo light={dark} /></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">{links}</nav>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex"><TimerPill dark={dark} /></span>
          {user ? (
            <>
              <span className={`hidden text-right text-[13px] leading-tight xl:block ${dark ? "text-aqua" : "text-deep/70"}`}>
                <b className={dark ? "text-white" : "text-deep"}>{user.displayName}</b><br />{team?.name ?? "Admin"}
              </span>
              <button className={`btn btn-sm ${dark ? "btn-ghost-light" : "btn-line"}`} onClick={() => { be.logout(); nav("/"); }}>Log out</button>
            </>
          ) : (
            <Link to="/login" className={`btn btn-sm ${dark ? "btn-brass" : "btn-kelp"}`}>Log in</Link>
          )}
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto px-5 pb-3 lg:hidden" aria-label="Main mobile">
        <span className="mr-1 sm:hidden"><TimerPill dark={dark} /></span>{links}
      </nav>
    </header>
  );
}
