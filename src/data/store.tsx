import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader } from "../components/Loader";
import { LocalBackend, type Backend } from "./backend";
import { RemoteBackend } from "./remote";
import { browserCipher } from "./vault";

const Ctx = createContext<Backend | null>(null);

export function BackendProvider({ children }: { children: ReactNode }) {
  // The Vercel build talks to the shared server; the GitHub Pages build keeps data in this browser.
  const [be] = useState<Backend>(() => import.meta.env.VITE_BACKEND === "remote" ? new RemoteBackend() : new LocalBackend(window.localStorage, browserCipher()));
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState("");
  const [minDone, setMinDone] = useState(false);
  const [hold, setHold] = useState(true);
  useEffect(() => { be.ready().then(() => setReady(true), (e: Error) => setFailed(e.message || "Can't reach the server.")); }, [be]);
  // Keep the loading page up long enough to be seen, then let the name finish decrypting.
  useEffect(() => { const t = setTimeout(() => setMinDone(true), 1700); return () => clearTimeout(t); }, []);
  useEffect(() => { if (ready && minDone) { const t = setTimeout(() => setHold(false), 450); return () => clearTimeout(t); } }, [ready, minDone]);
  if (failed) {
    return (
      <div className="grid min-h-screen place-items-center bg-deep px-6 text-center text-white">
        <div>
          <p className="font-display text-[26px] font-bold">The tank is offline</p>
          <p className="mt-2 max-w-md text-aqua/80">{failed}</p>
          <button className="btn btn-brass mt-6" onClick={() => location.reload()}>Try again</button>
        </div>
      </div>
    );
  }
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
