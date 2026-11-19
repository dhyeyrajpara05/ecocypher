import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { SiteHeader } from "../../components/SiteHeader";
import { useDB } from "../../data/store";
import Overview from "./Overview";
import Rounds from "./Rounds";
import Challenges from "./Challenges";
import Teams from "./Teams";
import { Announcements, Settings, Submissions, Types } from "./Misc";

const NAV = [
  ["", "Live monitor"],
  ["rounds", "Funding rounds"],
  ["challenges", "Challenges"],
  ["types", "Challenge types"],
  ["teams", "Teams & members"],
  ["submissions", "Submissions"],
  ["announcements", "Announcements"],
  ["settings", "Settings"],
] as const;

export default function Admin() {
  const db = useDB();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      {db.demo && (
        <div className="border-b border-brass/30 bg-brass-100 px-5 py-2 text-center text-[13px] text-deep/80">
          You're looking at demo data. Clear it under Settings when you're ready to set up the real event.
        </div>
      )}
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[13rem_1fr]">
        <aside>
          <p className="mb-3 font-display text-[15px] font-semibold">Sharks' Desk</p>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end
                className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2 text-[14px] font-medium transition-colors ${isActive ? "bg-deep text-white" : "text-deep/70 hover:bg-white hover:text-deep"}`}>
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <section className="min-w-0">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="rounds" element={<Rounds />} />
            <Route path="challenges" element={<Challenges />} />
            <Route path="types" element={<Types />} />
            <Route path="teams" element={<Teams />} />
            <Route path="submissions" element={<Submissions />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </section>
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
