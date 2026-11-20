import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { isMuted, useOnBump } from "./Faaah";

let ctx: AudioContext | null = null;

/** A short synthesised "cha-ching": two bright bell notes and a coin shimmer. */
export function playDeal() {
  if (isMuted()) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    const ac = ctx;
    if (ac.state === "suspended") void ac.resume();
    const t0 = ac.currentTime + 0.02;
    const out = ac.createGain();
    out.gain.value = 0.35;
    out.connect(ac.destination);
    const bell = (freq: number, at: number, len: number) => {
      for (const [mult, g] of [[1, 1], [2.76, 0.35], [5.4, 0.12]] as const) {
        const o = ac.createOscillator();
        o.type = "sine";
        o.frequency.value = freq * mult;
        const gain = ac.createGain();
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(g, at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0008, at + len);
        o.connect(gain).connect(out);
        o.start(at); o.stop(at + len + 0.05);
      }
    };
    bell(1318.5, t0, 0.5);          // E6
    bell(1975.5, t0 + 0.11, 0.9);   // B6
    for (let i = 0; i < 6; i++) bell(2600 + i * 180, t0 + 0.25 + i * 0.045, 0.18);
  } catch { /* audio unavailable */ }
}

const PIECES = ["coin", "leaf", "coin", "coin", "leaf", "spark"] as const;

function Burst() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
      {Array.from({ length: 30 }).map((_, i) => {
        const kind = PIECES[i % PIECES.length];
        const a = (i / 30) * Math.PI * 2 + (i % 3) * 0.2;
        const r = 170 + (i % 5) * 45;
        return (
          <motion.span key={i} className="absolute block"
            initial={{ x: 0, y: 0, scale: 0.4, rotate: 0, opacity: 1 }}
            animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.75 + 60, scale: 1, rotate: (i % 2 ? 1 : -1) * 280, opacity: [1, 1, 0] }}
            transition={{ duration: 1.3, ease: [0.15, 0.8, 0.3, 1], delay: 0.18 }}>
            {kind === "coin" && <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-brass-600 bg-brass text-[11px] font-black text-deep">₹</span>}
            {kind === "leaf" && <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 20 C 4 8 12 3 21 3 C 21 13 15 20 4 20 Z" fill="#1F7A5C" /><path d="M4 20 L 15 9" stroke="#DCF1E8" strokeWidth="1.5" /></svg>}
            {kind === "spark" && <span className="block h-2.5 w-2.5 rotate-45 bg-aqua" />}
          </motion.span>
        );
      })}
    </div>
  );
}

/** Full-screen "DEAL!" celebration, shown once per correct flag. */
export function DealPopup({ trigger, points, title, text }: { trigger: number; points: number; title: string; text?: string }) {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();
  useOnBump(trigger, () => {
    setShow(true);
    const id = setTimeout(() => setShow(false), 2600);
    return () => clearTimeout(id);
  });
  return (
    <AnimatePresence>
      {show && (
        <motion.div key={trigger} className="pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-kelp/20 backdrop-blur-[1px]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }} role="status" aria-live="polite">
          {/* light rays */}
          {!reduce && (
            <motion.div className="absolute h-[140vmax] w-[140vmax] opacity-30"
              style={{ background: "repeating-conic-gradient(from 0deg, #E2B13C 0deg 6deg, transparent 6deg 24deg)", maskImage: "radial-gradient(circle, black 0%, transparent 55%)", WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 55%)" }}
              initial={{ rotate: 0, scale: 0.6 }} animate={{ rotate: 40, scale: 1 }} transition={{ duration: 2.6, ease: "linear" }} />
          )}
          <div className="relative flex flex-col items-center text-center">
            {!reduce && <Burst />}
            {/* the stamp slams down */}
            <motion.div className="relative rounded-[28px] border-[6px] border-kelp-600 bg-white px-10 py-5 shadow-[10px_10px_0_#0B2A3C]"
              initial={{ scale: 3, rotate: -18, opacity: 0 }} animate={{ scale: [3, 0.92, 1], rotate: [-18, -6, -8], opacity: 1 }}
              transition={{ duration: 0.45, times: [0, 0.75, 1], ease: "easeIn" }}>
              <p className="font-display text-[clamp(56px,13vw,132px)] font-black leading-none tracking-tight text-kelp-600">{text?.trim() || "DEAL!"}</p>
            </motion.div>
            <motion.p className="mt-6 font-display text-[clamp(28px,6vw,52px)] font-black text-brass drop-shadow-[3px_3px_0_#0B2A3C]"
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 14 }}>
              +{points} points
            </motion.p>
            <motion.p className="mt-3 rounded-full bg-deep px-4 py-1.5 text-[15px] font-semibold text-white"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
              The sharks invested in {title}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
