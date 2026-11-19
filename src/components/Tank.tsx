import { motion, useReducedMotion } from "framer-motion";

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
      {/* bubbles */}
      {!reduce && [8, 21, 37, 55, 71, 86, 94].map((x, i) => (
        <span key={x} className="absolute bottom-0 block rounded-full border border-aqua/40"
          style={{ left: `${x}%`, width: 6 + (i % 3) * 4, height: 6 + (i % 3) * 4, animation: `ec-rise ${9 + (i % 4) * 2.5}s ease-in ${i * 1.7}s infinite` }} />
      ))}
    </div>
  );
}
