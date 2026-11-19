import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader } from "../components/Loader";
import { LocalBackend, type Backend } from "./backend";
import { browserCipher } from "./vault";

const Ctx = createContext<Backend | null>(null);

export function BackendProvider({ children }: { children: ReactNode }) {
  const [be] = useState<Backend>(() => new LocalBackend(window.localStorage, browserCipher()));
  const [ready, setReady] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const [hold, setHold] = useState(true);
  useEffect(() => { be.ready().then(() => setReady(true)); }, [be]);
  // Keep the loading page up long enough to be seen, then let the name finish decrypting.
  useEffect(() => { const t = setTimeout(() => setMinDone(true), 1700); return () => clearTimeout(t); }, []);
  useEffect(() => { if (ready && minDone) { const t = setTimeout(() => setHold(false), 450); return () => clearTimeout(t); } }, [ready, minDone]);
  return (
    <>
      {ready && <Ctx.Provider value={be}>{children}</Ctx.Provider>}
      <AnimatePresence>{hold && <Loader key="loader" done={ready && minDone} />}</AnimatePresence>
    </>
  );
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
