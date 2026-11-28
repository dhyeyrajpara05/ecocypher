import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { TimerPill } from "../../components/chrome";
import { Logo } from "../../components/ui";
import { useBackend, useDB, useUser } from "../../data/store";
import Dashboard from "./Dashboard";
import Post from "./Post";
import Library from "./Library";
import Teams from "./Teams";
import Soundboard from "./Soundboard";
import Archive from "./Archive";
import Finals from "./Finals";
import { NotificationsAdmin, Settings, Submissions } from "./Misc";

const ICONS: Record<string, JSX.Element> = {
  dash: <path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" />,
  post: <path d="M12 5v14M5 12h14" />,
  lib: <path d="M4 6h16M4 12h16M4 18h10" />,
  archive: <path d="M3 5h18v4H3zM5 9v10h14V9M10 13h4" />,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4" />,
  teams: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-6M21 20c0-2-1.5-4-4-4.6" /></>,
  bell: <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />,
  subs: <path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" />,
  sound: <path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></>,
};

const NAV: [string, string, string][] = [
  ["", "Dashboard", "dash"],
  ["post", "Post challenges", "post"],
  ["library", "Challenge library", "lib"],
  ["archive", "Archive", "archive"],
  ["teams", "Teams & members", "teams"],
  ["notifications", "Notifications", "bell"],
  ["soundboard", "Soundboard", "sound"],
  ["submissions", "Submissions", "subs"],
  ["finals", "Final results", "trophy"],
  ["settings", "Settings", "gear"],
];

export default function Admin() {
  const db = useDB();
  const be = useBackend();
  const user = useUser();
  const nav = useNavigate();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="bg-deep text-aqua lg:sticky lg:top-0 lg:h-screen">
        <div className="flex items-center justify-between px-5 py-5 lg:block">
          <NavLink to="/"><Logo light size={28} /></NavLink>
          <p className="hidden pt-1 text-[12.5px] text-aqua/70 lg:block">Admin dashboard</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0" aria-label="Admin">
          {NAV.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end
              className={({ isActive }) => `flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${isActive ? "bg-white/12 bg-white/10 text-white" : "text-aqua/75 hover:bg-white/5 hover:text-white"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[icon]}</svg>
              {label}
              {icon === "bell" && db.notifications.length > 0 && <span className="ml-auto text-[12px] text-aqua/60">{db.notifications.length}</span>}
              {icon === "archive" && db.challenges.some((c) => c.archivedAt) && <span className="ml-auto text-[12px] text-aqua/60">{db.challenges.filter((c) => c.archivedAt).length}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-5 pt-8 text-[13px] lg:block">
          <p className="text-white">{user?.displayName}</p>
          <div className="mt-2 flex gap-2">
            <NavLink className="text-aqua/75 underline-offset-4 hover:underline" to="/scoreboard">Scoreboard</NavLink>
            <NavLink className="text-aqua/75 underline-offset-4 hover:underline" to="/all-challenge-view">Testing page</NavLink>
            <button className="text-aqua/75 underline-offset-4 hover:underline" onClick={() => { be.logout(); nav("/"); }}>Log out</button>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-fin-200/60 bg-foam/90 px-5 py-3 backdrop-blur sm:px-8">
          <p className="text-[14px] text-deep/70">{db.settings.eventName}{db.demo && <span className="ml-2 rounded-full bg-brass-100 px-2 py-0.5 text-[12px] font-semibold text-brass-600">Demo data</span>}
            {import.meta.env.VITE_BACKEND !== "remote" && <span className="ml-2 rounded-full bg-coral-100 px-2 py-0.5 text-[12px] font-semibold text-coral" title="Changes stay in this browser. Players on other devices won't see them. Use the Vercel version for the real event.">This browser only</span>}</p>
          <div className="flex items-center gap-2">
            <TimerPill />
            <button className="btn btn-line btn-sm lg:hidden" onClick={() => { be.logout(); nav("/"); }}>Log out</button>
          </div>
        </div>
        <main className="px-5 py-8 sm:px-8">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="post" element={<Post />} />
            <Route path="library" element={<Library />} />
            <Route path="archive" element={<Archive />} />
            <Route path="finals" element={<Finals />} />
            <Route path="teams" element={<Teams />} />
            <Route path="notifications" element={<NotificationsAdmin />} />
            <Route path="soundboard" element={<Soundboard />} />
            <Route path="submissions" element={<Submissions />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export function PageHead({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-bold">{title}</h1>
        {children && <p className="mt-1 max-w-2xl text-[14.5px] text-deep/70">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
