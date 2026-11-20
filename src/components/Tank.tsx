import { motion, useReducedMotion } from "framer-motion";

/** A kelp frond rooted on the seabed, swaying from its base. */
function Kelp({ x, h, delay, tone }: { x: string; h: number; delay: number; tone: string }) {
  const blades = Math.round(h / 34);
  return (
    <svg className="absolute bottom-0" style={{ left: x, height: h, width: h * 0.32, transformOrigin: "50% 100%", animation: `ec-sway ${6 + delay}s ease-in-out ${-delay}s infinite alternate` }}
      viewBox={`0 0 40 ${h}`} preserveAspectRatio="xMidYMax meet">
      <path d={`M20 ${h} C 12 ${h * 0.75}, 28 ${h * 0.5}, 18 ${h * 0.25} S 22 6, 20 0`} stroke={tone} strokeWidth="4" fill="none" strokeLinecap="round" />
      {Array.from({ length: blades }).map((_, i) => {
        const y = h - 18 - i * 32;
        const left = i % 2 === 0;
        return <path key={i} d={left ? `M20 ${y} C 6 ${y - 6}, 2 ${y - 22}, 8 ${y - 30} C 14 ${y - 20}, 16 ${y - 10}, 20 ${y}` : `M20 ${y} C 34 ${y - 6}, 38 ${y - 22}, 32 ${y - 30} C 26 ${y - 20}, 24 ${y - 10}, 20 ${y}`} fill={tone} />;
      })}
    </svg>
  );
}

/** A small fish; schools swim across the tank at different depths and speeds. */
function Fish({ top, size, dur, delay, colour, reverse }: { top: string; size: number; dur: number; delay: number; colour: string; reverse?: boolean }) {
  return (
    <div className="absolute left-0" style={{ top, animation: `${reverse ? "ec-swim-l" : "ec-swim-r"} ${dur}s linear ${-delay}s infinite` }}>
      <svg width={size} height={size * 0.55} viewBox="0 0 40 22" style={{ transform: reverse ? "scaleX(-1)" : undefined }}>
        <g style={{ animation: "ec-wiggle .5s ease-in-out infinite alternate", transformOrigin: "30% 50%" }}>
          <path d="M2 11 L 10 4 L 9 11 L 10 18 Z" fill={colour} opacity=".85" />
          <ellipse cx="22" cy="11" rx="14" ry="7.5" fill={colour} />
          <path d="M18 4 Q 22 0 26 4" fill={colour} />
          <circle cx="31" cy="9.5" r="1.6" fill="#071d29" />
        </g>
      </svg>
    </div>
  );
}

/** Litter drifting through the water: the thing the event is about. */
function Litter({ kind, left, top, dur, delay }: { kind: "bottle" | "bag" | "can" | "straw" | "ring"; left: string; top: string; dur: number; delay: number }) {
  const art = {
    bottle: <><rect x="8" y="8" width="14" height="30" rx="5" fill="#A9DCD5" opacity=".75" /><rect x="11" y="2" width="8" height="7" rx="1.5" fill="#5C7A86" /><rect x="8" y="18" width="14" height="7" fill="#fff" opacity=".35" /></>,
    bag: <path d="M6 10 Q 15 2 24 10 L 27 32 Q 21 28 18 34 Q 14 28 10 34 Q 7 28 3 32 Z M10 10 Q 15 0 20 10" fill="#E6F5F2" stroke="#D3EEEA" strokeWidth="1" opacity=".55" />,
    can: <><rect x="6" y="10" width="18" height="24" rx="3" fill="#D9534F" opacity=".8" /><rect x="6" y="18" width="18" height="6" fill="#fff" opacity=".45" /><rect x="8" y="8" width="14" height="3" rx="1" fill="#CCDADF" /></>,
    straw: <rect x="13" y="0" width="4" height="40" rx="2" fill="#E2B13C" opacity=".85" transform="rotate(30 15 20)" />,
    ring: <g fill="none" stroke="#CCDADF" strokeWidth="2.5" opacity=".7"><ellipse cx="9" cy="20" rx="6" ry="5" /><ellipse cx="21" cy="20" rx="6" ry="5" /><ellipse cx="15" cy="27" rx="6" ry="5" /></g>,
  }[kind];
  return (
    <svg className="absolute" width="30" height="40" viewBox="0 0 30 40" style={{ left, top, animation: `ec-drift ${dur}s ease-in-out ${-delay}s infinite` }}>{art}</svg>
  );
}

/**
 * The signature element: a cross-section of a tank. A water surface rolls across, and a shark fin
 * patrols the surface, turning at each end. Purely decorative (aria-hidden).
 */
export function Tank({ surface = 34 }: { surface?: number }) {
  const reduce = useReducedMotion();
  const wave = "M0 20 Q 75 0 150 20 T 300 20 T 450 20 T 600 20 T 750 20 T 900 20 T 1050 20 T 1200 20 V60 H0 Z";
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes ec-roll { from { transform: translateX(0) } to { transform: translateX(-300px) } }
        @keyframes ec-roll2 { from { transform: translateX(-300px) } to { transform: translateX(0) } }
        @keyframes ec-rise { 0% { transform: translateY(0); opacity: 0 } 15% { opacity: .55 } 100% { transform: translateY(-62vh); opacity: 0 } }
        @keyframes ec-sway { from { transform: rotate(-4deg) } to { transform: rotate(5deg) } }
        @keyframes ec-swim-r { from { transform: translateX(-120px) } to { transform: translateX(calc(100vw + 120px)) } }
        @keyframes ec-swim-l { from { transform: translateX(calc(100vw + 120px)) } to { transform: translateX(-120px) } }
        @keyframes ec-wiggle { from { transform: skewY(-4deg) } to { transform: skewY(4deg) } }
        @keyframes ec-drift { 0% { transform: translate(0, 0) rotate(-10deg) } 50% { transform: translate(26px, 18px) rotate(14deg) } 100% { transform: translate(0, 0) rotate(-10deg) } }
        @media (prefers-reduced-motion: reduce) { .ec-life * { animation: none !important } }
      `}</style>
      {/* air above the waterline */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-[#071d29] to-deep-700" style={{ height: `${surface}%` }} />
      {/* water body */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-deep-600 via-deep to-[#06202e]" style={{ top: `${surface}%` }} />
      {/* light shafts */}
      <div className="absolute inset-x-0 bottom-0 opacity-[.07]" style={{ top: `${surface}%`, background: "repeating-linear-gradient(105deg, #D3EEEA 0 2px, transparent 2px 90px)" }} />
      {/* two rolling surface layers */}
      <svg className="absolute left-0 w-[calc(100%+300px)]" style={{ top: `calc(${surface}% - 20px)`, height: 60, animation: reduce ? undefined : "ec-roll 9s linear infinite" }} viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d={wave} fill="#1E5B7A" opacity=".55" />
      </svg>
      <svg className="absolute left-0 w-[calc(100%+300px)]" style={{ top: `calc(${surface}% - 12px)`, height: 60, animation: reduce ? undefined : "ec-roll2 13s linear infinite" }} viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d={wave} fill="#164863" />
      </svg>
      {/* the fin */}
      <motion.div className="absolute" style={{ top: `calc(${surface}% - 46px)` }}
        initial={{ left: "62%" }}
        animate={reduce ? undefined : { left: ["62%", "90%", "90%", "48%", "48%", "62%"], scaleX: [1, 1, -1, -1, 1, 1] }}
        transition={{ duration: 22, times: [0, .32, .36, .82, .86, 1], repeat: Infinity, ease: "easeInOut" }}>
        <svg width="74" height="58" viewBox="0 0 74 58">
          <path d="M6 54 C 22 46 36 30 44 2 C 52 22 60 40 72 54 Z" fill="#5C7A86" />
          <path d="M44 2 C 52 22 60 40 72 54 L 58 54 C 52 40 47 24 44 2Z" fill="#A7BCC4" opacity=".35" />
          <path d="M0 55 Q 37 46 74 55" stroke="#D3EEEA" strokeWidth="2" fill="none" opacity=".55" />
        </svg>
      </motion.div>
      {/* sea life and litter, below the surface */}
      <div className="ec-life absolute inset-x-0 bottom-0" style={{ top: `${surface}%` }}>
        {[
          { x: "1%", h: 230, d: 0, t: "#1F7A5C" }, { x: "5%", h: 170, d: 1.2, t: "#186349" }, { x: "9%", h: 120, d: 2.1, t: "#2C8A68" },
          { x: "84%", h: 150, d: 0.6, t: "#186349" }, { x: "89%", h: 260, d: 1.8, t: "#1F7A5C" }, { x: "95%", h: 190, d: 0.3, t: "#2C8A68" },
          { x: "62%", h: 90, d: 2.6, t: "#186349" },
        ].map((k) => <Kelp key={k.x} x={k.x} h={k.h} delay={k.d} tone={k.t} />)}
        <Fish top="58%" size={34} dur={26} delay={0} colour="#E2B13C" />
        <Fish top="61%" size={24} dur={26} delay={1.4} colour="#E2B13C" />
        <Fish top="55%" size={22} dur={26} delay={2.2} colour="#E2B13C" />
        <Fish top="80%" size={40} dur={34} delay={9} colour="#7CC4A6" reverse />
        <Fish top="84%" size={26} dur={34} delay={10.5} colour="#7CC4A6" reverse />
        <Fish top="40%" size={20} dur={40} delay={20} colour="#A9DCD5" reverse />
        <Litter kind="bottle" left="70%" top="22%" dur={11} delay={0} />
        <Litter kind="bag" left="44%" top="66%" dur={14} delay={4} />
        <Litter kind="can" left="78%" top="70%" dur={12} delay={7} />
        <Litter kind="straw" left="22%" top="78%" dur={10} delay={2} />
        <Litter kind="ring" left="56%" top="38%" dur={13} delay={5} />
      </div>
      {/* bubbles */}
      {!reduce && [8, 21, 37, 55, 71, 86, 94].map((x, i) => (
        <span key={x} className="absolute bottom-0 block rounded-full border border-aqua/40"
          style={{ left: `${x}%`, width: 6 + (i % 3) * 4, height: 6 + (i % 3) * 4, animation: `ec-rise ${9 + (i % 4) * 2.5}s ease-in ${i * 1.7}s infinite` }} />
      ))}
    </div>
  );
}
