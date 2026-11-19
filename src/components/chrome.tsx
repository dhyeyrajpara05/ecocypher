import { eventStatus } from "../data/scoring";
import { useDB, useNow } from "../data/store";
import { countdown } from "../lib/format";

/** Shared footer on every page. */
export function Footer({ dark = false }: { dark?: boolean }) {
  return (
    <footer className={dark ? "bg-deep text-aqua/80" : "border-t border-fin-200/70 text-fin"}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[13px] sm:px-8">
        <p className={`font-display text-[12.5px] font-semibold tracking-wide ${dark ? "text-white" : "text-deep"}`}>Created by DEAKIN RESEARCH &amp; TECHNOLOGY CLUB</p>
        <p>EcoCypher, a sustainability capture-the-flag. Companies and people in the challenges are fictional.</p>
      </div>
    </footer>
  );
}

/** The event clock: counts down the three hours once the admin starts it. */
export function useEventClock() {
  const db = useDB();
  const now = useNow(1000);
  const status = eventStatus(db, now);
  const { startsAt, endsAt, durationMinutes } = db.settings;
  const total = startsAt && endsAt ? Date.parse(endsAt) - Date.parse(startsAt) : durationMinutes * 60_000;
  const left = status === "live" && endsAt ? Date.parse(endsAt) - now.getTime() : status === "ended" ? 0 : total;
  return {
    status, left, total,
    text: status === "live" && endsAt ? countdown(endsAt, now) : status === "ended" ? "0:00:00" : `${Math.floor(durationMinutes / 60)}:${String(durationMinutes % 60).padStart(2, "0")}:00`,
    fraction: total ? Math.min(1, Math.max(0, 1 - left / total)) : 0,
  };
}

export function TimerPill({ dark = false }: { dark?: boolean }) {
  const t = useEventClock();
  const low = t.status === "live" && t.left < 15 * 60_000;
  const label = t.status === "live" ? "left" : t.status === "ended" ? "Time's up" : "Not started";
  return (
    <span role="timer" aria-live="off" aria-label={`Event timer ${t.text} ${label}`}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${low ? "bg-coral text-white" : dark ? "bg-white/10 text-white" : "bg-deep text-white"}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>
      {t.status === "ended" ? "Time's up" : <><span className="tabular font-display">{t.text}</span><span className="font-normal opacity-75">{label}</span></>}
    </span>
  );
}

/** Large three-hour clock with a progress ring, for the hero and the admin dashboard. */
export function BigTimer({ dark = true }: { dark?: boolean }) {
  const t = useEventClock();
  const r = 54, circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-5">
      <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">
        <circle cx="66" cy="66" r={r} stroke={dark ? "rgba(255,255,255,.12)" : "#E6F5F2"} strokeWidth="10" fill="none" />
        <circle cx="66" cy="66" r={r} stroke={t.status === "live" && t.left < 15 * 60_000 ? "#D9534F" : "#E2B13C"} strokeWidth="10" fill="none"
          strokeDasharray={circ} strokeDashoffset={circ * t.fraction} strokeLinecap="round" transform="rotate(-90 66 66)" style={{ transition: "stroke-dashoffset 1s linear" }} />
      </svg>
      <div role="timer" aria-label={`Time remaining ${t.text}`}>
        <p className={`font-display text-[40px] font-bold leading-none tabular ${dark ? "text-white" : "text-deep"}`}>{t.text}</p>
        <p className={`mt-2 text-[14px] ${dark ? "text-aqua/80" : "text-deep/70"}`}>
          {t.status === "live" ? "left on the clock" : t.status === "ended" ? "Time's up. Submissions are closed." : "The 3-hour clock starts at kickoff."}
        </p>
      </div>
    </div>
  );
}
