import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const NAME = "ECOCYPHER";
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}#$%";
const LINES = [
  "Hashing the flags",
  "Briefing the sharks",
  "Sorting the recycling",
  "Polishing the pitch deck",
  "Topping up the tank",
];

/** The site's name decrypts itself one letter at a time, like a cipher being cracked. */
function Decrypt({ done }: { done: boolean }) {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 55);
    return () => clearInterval(id);
  }, [reduce]);
  const solved = reduce || done ? NAME.length : Math.min(NAME.length, Math.floor(tick / 3));
  return (
    <p className="font-display text-[clamp(30px,7vw,64px)] font-black tracking-[0.06em] text-white" aria-label={NAME}>
      {NAME.split("").map((ch, i) => (
        <span key={i} aria-hidden="true" className={i < solved ? "" : "text-aqua-400/70"}>
          {i < solved ? ch : GLYPHS[(tick * 7 + i * 13) % GLYPHS.length]}
        </span>
      ))}
    </p>
  );
}

/** Litter drifting down through the tank: a bottle, a can and a straw (SVG-native animation). */
function Litter() {
  const items = [
    { x: 46, d: 0, spin: -160, path: <><rect x="-5" y="-12" width="10" height="22" rx="4" fill="#A9DCD5" /><rect x="-3" y="-16" width="6" height="5" rx="1" fill="#5C7A86" /></> },
    { x: 120, d: 1.1, spin: 140, path: <><rect x="-6" y="-9" width="12" height="18" rx="2" fill="#D9534F" /><rect x="-6" y="-3" width="12" height="4" fill="#fff" opacity=".7" /></> },
    { x: 178, d: 0.5, spin: -120, path: <rect x="-1.5" y="-14" width="3" height="28" rx="1.5" fill="#E2B13C" /> },
  ];
  return (
    <>
      {items.map((it, i) => (
        <g key={i} transform={`translate(${it.x} -30)`}>
          <animateTransform attributeName="transform" type="translate" values={`${it.x} -30; ${it.x} 175`} dur="3.4s" begin={`${it.d}s`} repeatCount="indefinite" />
          <g>
            <animateTransform attributeName="transform" type="rotate" values={`0; ${it.spin}`} dur="3.4s" begin={`${it.d}s`} repeatCount="indefinite" />
            {it.path}
          </g>
        </g>
      ))}
    </>
  );
}

/** Full-screen loading page: a tank fills with water while a fin circles and the name decrypts. */
export function Loader({ done }: { done: boolean }) {
  const reduce = useReducedMotion();
  const [line, setLine] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLine((l) => (l + 1) % LINES.length), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <motion.div className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-deep" role="status" aria-live="polite"
      exit={{ clipPath: "circle(0% at 50% 50%)", transition: { duration: 0.6, ease: [0.7, 0, 0.3, 1] } }}
      initial={{ clipPath: "circle(150% at 50% 50%)" }}>
      <div className="flex flex-col items-center px-6">
        <svg viewBox="0 0 220 160" className="w-[min(78vw,340px)]" aria-hidden="true">
          <defs>
            <clipPath id="tank"><rect x="10" y="10" width="200" height="140" rx="18" /></clipPath>
          </defs>
          <g clipPath="url(#tank)">
            <rect x="10" y="10" width="200" height="140" fill="#0F3550" />
            {/* water rises, with a moving wave on top */}
            <motion.g initial={{ y: 130 }} animate={{ y: done ? 18 : 40 }} transition={{ duration: done ? 0.5 : 2.2, ease: "easeOut" }}>
              <g transform="translate(100 16)">
                {!reduce && <animateTransform attributeName="transform" type="translate" values="-40 16; 100 13; 240 16" dur="2.6s" repeatCount="indefinite" />}
                <path d="M0 0 L 12 -24 L 24 0 Z" fill="#CCDADF" />
              </g>
              <motion.path d="M-200 10 Q -175 0 -150 10 T -100 10 T -50 10 T 0 10 T 50 10 T 100 10 T 150 10 T 200 10 T 250 10 T 300 10 T 350 10 T 400 10 V 200 H -200 Z"
                fill="#1E5B7A" animate={reduce ? undefined : { x: [0, 100] }} transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }} />
              <motion.path d="M-200 16 Q -170 8 -140 16 T -80 16 T -20 16 T 40 16 T 100 16 T 160 16 T 220 16 T 280 16 T 340 16 T 400 16 V 200 H -200 Z"
                fill="#164863" animate={reduce ? undefined : { x: [0, -120] }} transition={{ duration: 3.1, repeat: Infinity, ease: "linear" }} />
            </motion.g>
            {!reduce && <Litter />}
            {/* the fin, circling */}
            {/* bubbles */}
            {!reduce && [30, 90, 160, 196].map((x, i) => (
              <motion.circle key={x} cx={x} r={2 + (i % 2)} fill="#D3EEEA" opacity=".6"
                initial={{ cy: 160 }} animate={{ cy: 60, opacity: [0.6, 0] }} transition={{ duration: 2 + i * 0.4, repeat: Infinity, delay: i * 0.3 }} />
            ))}
          </g>
          <rect x="10" y="10" width="200" height="140" rx="18" fill="none" stroke="#A9DCD5" strokeWidth="3" />
          <path d="M26 22 v 30" stroke="#fff" strokeOpacity=".25" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <div className="mt-7 text-center"><Decrypt done={done} /></div>
        <motion.p key={line} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-[15px] text-aqua/80">
          {done ? "Doors open" : `${LINES[line]}…`}
        </motion.p>
      </div>
      <p className="absolute bottom-6 text-[12.5px] text-aqua/50">Deakin Research &amp; Technology Club</p>
    </motion.div>
  );
}
