import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isMuted } from "./Faaah";

/**
 * Two secrets on the challenges page. Neither gives points or touches flags.
 *  1. Konami code (↑ ↑ ↓ ↓ ← → ← → B A): a feeding frenzy of sharks swims across the screen.
 *     A hint is printed in the browser console, where CTF players love to look.
 *  1b. Or just click the little fin peeking up from the bottom of the page.
 *  2. Click your team's valuation 3 times: "Australia mode" turns the page upside down for a moment,
 *     a nod to Deakin's home.
 */
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let hinted = false;

function chomp() {
  if (isMuted()) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    const t = ac.currentTime;
    // The classic two-note shark theme, but cheerful.
    [0, 0.32, 0.64, 0.8, 0.96, 1.12].forEach((d, i) => {
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = "triangle"; o.frequency.value = i % 2 ? 87.3 : 82.4;
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.4, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.22);
      o.connect(g).connect(ac.destination); o.start(t + d); o.stop(t + d + 0.25);
    });
    setTimeout(() => void ac.close(), 2000);
  } catch { /* no audio */ }
}

function SwimmingShark({ y, size, dur, delay, flip, colour }: { y: number; size: number; dur: number; delay: number; flip: boolean; colour: string }) {
  return (
    <motion.svg viewBox="0 0 64 34" width={size} height={size * 0.53} className="absolute" style={{ top: `${y}%`, scaleX: flip ? -1 : 1 }}
      initial={{ x: flip ? "110vw" : "-20vw" }} animate={{ x: flip ? "-20vw" : "110vw", y: [0, -10, 0, 10, 0] }}
      transition={{ x: { duration: dur, delay, ease: "linear" }, y: { duration: 1.2, repeat: Infinity } }}>
      <path d="M2 20 L 10 12 L 9 20 L 10 28 Z" fill={colour} />
      <path d="M9 20 C 16 10, 44 8, 62 20 C 46 30, 18 30, 9 20 Z" fill={colour} />
      <path d="M18 23 C 30 29, 48 28, 60 21 C 46 26, 30 26, 18 23 Z" fill="#fff" opacity=".85" />
      <path d="M30 13 L 36 4 L 40 13 Z" fill={colour} />
      <circle cx="51" cy="17" r="2" fill="#0B2A3C" />
      <path d="M50 23 l 2 2 l 2 -2 l 2 2 l 2 -2" stroke="#0B2A3C" strokeWidth="1.2" fill="none" />
    </motion.svg>
  );
}

export function EasterEggs() {
  const reduce = useReducedMotion();
  const [frenzy, setFrenzy] = useState(0);
  const [aussie, setAussie] = useState(false);

  useEffect(() => {
    if (!hinted) {
      hinted = true;
      console.log("%c🦈 psst… the sharks respond to an old cheat code:  ↑ ↑ ↓ ↓ ← → ← → B A", "font: 600 13px system-ui; color: #1F7A5C");
    }
    let pos = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;   // never while typing a flag
      const want = KONAMI[pos];
      pos = e.key.toLowerCase() === want.toLowerCase() || e.key === want ? pos + 1 : e.key === KONAMI[0] ? 1 : 0;
      if (pos === KONAMI.length) { pos = 0; setFrenzy((n) => n + 1); chomp(); }
    };
    let clicks = 0, timer: ReturnType<typeof setTimeout> | null = null;
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.("[data-egg='valuation']")) return;
      clicks++;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 1500);
      if (clicks >= 3) { clicks = 0; setAussie(true); setTimeout(() => setAussie(false), 3200); }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("click", onClick); };
  }, []);

  // Australia mode: flip the whole page briefly.
  useEffect(() => {
    if (!aussie || reduce) return;
    const root = document.getElementById("root");
    if (!root) return;
    root.style.transition = "transform .7s cubic-bezier(.6,-0.3,.4,1.3)";
    root.style.transform = "rotate(180deg)";
    const t = setTimeout(() => { root.style.transform = ""; }, 2400);
    return () => { clearTimeout(t); root.style.transform = ""; };
  }, [aussie, reduce]);

  useEffect(() => {
    if (!frenzy) return;
    const t = setTimeout(() => setFrenzy(0), 7000);
    return () => clearTimeout(t);
  }, [frenzy]);

  const colours = ["#1E5B7A", "#1F7A5C", "#8E4B7A", "#B88A1F", "#5C7A86", "#D9534F"];
  // Rendered outside the page root, so the messages stay the right way up in Australia mode.
  return createPortal(
    <>
      {/* The peeking fin: one click starts the frenzy. */}
      <motion.button type="button" aria-label="A shark fin is peeking out. Click it." title="Psst…"
        className="fixed bottom-0 right-[12%] z-[60] cursor-pointer"
        initial={{ y: 30 }} animate={reduce ? { y: 6 } : { y: [10, 2, 10], x: [0, -18, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ y: -6, scale: 1.1 }} whileTap={{ scale: 0.9 }}
        onClick={() => { setFrenzy((n) => n + 1); chomp(); }}>
        <svg width="46" height="40" viewBox="0 0 74 58" aria-hidden="true">
          <path d="M6 54 C 22 46 36 30 44 2 C 52 22 60 40 72 54 Z" fill="#5C7A86" />
          <path d="M44 2 C 52 22 60 40 72 54 L 58 54 C 52 40 47 24 44 2Z" fill="#A7BCC4" opacity=".4" />
          <path d="M0 55 Q 37 46 74 55" stroke="#1E5B7A" strokeWidth="3" fill="none" opacity=".6" />
        </svg>
      </motion.button>
      <AnimatePresence>
        {frenzy > 0 && (
          <motion.div key={frenzy} className="pointer-events-none fixed inset-0 z-[90] overflow-hidden bg-deep/25"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-live="polite">
            {!reduce && Array.from({ length: 16 }).map((_, i) => (
              <SwimmingShark key={i} y={6 + ((i * 37) % 84)} size={50 + (i % 4) * 22} dur={3.2 + (i % 5) * 0.7} delay={(i % 6) * 0.25}
                flip={i % 3 === 0} colour={colours[i % colours.length]} />
            ))}
            <motion.div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-4"
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 16 }}>
              <div className="rounded-3xl border-4 border-deep bg-white px-6 py-4 text-center shadow-[8px_8px_0_#0B2A3C]">
                <p className="font-display text-[clamp(26px,6vw,52px)] font-black text-deep">FEEDING FRENZY!</p>
                <p className="mt-1 text-[15px] text-deep/70">You found the secret current. 0 points, 100% respect.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {aussie && (
          <motion.div className="pointer-events-none fixed inset-x-0 top-6 z-[90] flex justify-center px-4"
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }} role="status">
            <p className="rounded-full bg-brass px-5 py-2.5 text-[15px] font-bold text-deep shadow-lg">G'day! Australia mode: greetings from Deakin's home 🦘</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
