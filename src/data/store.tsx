import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { LocalBackend, type Backend } from "./backend";

const Ctx = createContext<Backend | null>(null);

export function BackendProvider({ children }: { children: ReactNode }) {
  const [be] = useState<Backend>(() => new LocalBackend());
  const [ready, setReady] = useState(false);
  useEffect(() => { be.ready().then(() => setReady(true)); }, [be]);
  if (!ready) {
    return <div className="grid min-h-screen place-items-center bg-deep font-display text-aqua">Filling the tank…</div>;
  }
  return <Ctx.Provider value={be}>{children}</Ctx.Provider>;
}

export function useBackend(): Backend {
  const be = useContext(Ctx);
  if (!be) throw new Error("BackendProvider missing");
  return be;
}

/** Re-renders whenever data changes (including from another tab). */
export function useDB() {
  const be = useBackend();
  return useSyncExternalStore(be.subscribe.bind(be), () => be.db());
}

export function useUser() {
  const be = useBackend();
  return useSyncExternalStore(be.subscribe.bind(be), () => be.currentUser());
}

/** A clock that ticks so scheduled rounds open and countdowns move without a reload. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
