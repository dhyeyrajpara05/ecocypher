import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { ChallengeType } from "../data/types";

export function Logo({ light = false, size = 30 }: { light?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill={light ? "#F4FAF9" : "#0B2A3C"} />
        <path d="M7 21.5c4-1 7-4.5 9-12 2.6 5 6 9 10 12z" fill="#E2B13C" />
        <path d="M5 24c2.7 1.8 5.3 1.8 8 0s5.3-1.8 8 0 5.3 1.8 6 1" stroke="#7CC4A6" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <span className={`font-display text-[19px] font-bold tracking-tight ${light ? "text-white" : "text-deep"}`}>EcoCypher</span>
    </span>
  );
}

export function TypeChip({ type }: { type?: ChallengeType }) {
  if (!type) return null;
  return <span className="chip" style={{ background: `${type.colour}1a`, color: type.colour }}><i className="h-1.5 w-1.5 rounded-full" style={{ background: type.colour }} />{type.name}</span>;
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-deep/50 p-4 pt-[6vh] backdrop-blur-[2px]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div role="dialog" aria-modal="true" aria-label={title}
            className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-3xl bg-white p-6 shadow-[0_30px_80px_-30px_rgba(11,42,60,.6)] sm:p-8`}
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 300 }}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold">{title}</h2>
              <button className="rounded-full p-1.5 text-fin hover:bg-foam" onClick={onClose} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" fill="none"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type Toast = { id: number; text: string; tone: "ok" | "bad" | "info" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
              className={`max-w-sm rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${t.tone === "ok" ? "bg-kelp text-white" : t.tone === "bad" ? "bg-coral text-white" : "bg-deep text-aqua"}`}>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/** Runs a backend action, then shows `ok` as a toast, or the error if the server refused it. */
export function useRun() {
  const toast = useContext(ToastCtx);
  return async (action: Promise<unknown> | (() => Promise<unknown>), ok?: string) => {
    try {
      await (typeof action === "function" ? action() : action);
      if (ok) toast(ok, "ok");
      return true;
    } catch (e) { toast((e as Error).message, "bad"); return false; }
  };
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-fin-200 bg-white/60 px-6 py-10 text-center">
      <p className="font-display text-base font-semibold">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-[14px] text-fin">{children}</div>}
    </div>
  );
}

/** Animated number for valuations. */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const from = shown, start = performance.now(), dur = 700;
    if (from === value) return;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className={`tabular ${className}`}>{shown.toLocaleString("en-IN")}</span>;
}
