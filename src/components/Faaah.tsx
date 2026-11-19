import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const MUTE_KEY = "ecocypher:muted";

export function isMuted() {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}

export function useMute(): [boolean, () => void] {
  const [muted, setMuted] = useState(isMuted);
  const toggle = () => {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch { /* storage blocked */ }
  };
  return [muted, toggle];
}

let ctx: AudioContext | null = null;

/**
 * A synthesised, falling "FAAAAAH": a breathy "f", then a sawtooth voice through two vowel
 * formants that slides down an octave and a half with a wobble. No audio file needed.
 */
export function playFaaah() {
  if (isMuted()) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    const ac = ctx;
    if (ac.state === "suspended") void ac.resume();
    const t = ac.currentTime + 0.02;
    const out = ac.createGain();
    out.gain.value = 0.55;
    out.connect(ac.destination);

    // "f": a short burst of filtered noise
    const len = Math.floor(ac.sampleRate * 0.22);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const hiss = ac.createBiquadFilter();
    hiss.type = "bandpass"; hiss.frequency.value = 4200; hiss.Q.value = 0.8;
    const nGain = ac.createGain();
    nGain.gain.setValueAtTime(0, t);
    nGain.gain.linearRampToValueAtTime(0.5, t + 0.05);
    nGain.gain.linearRampToValueAtTime(0, t + 0.22);
    noise.connect(hiss).connect(nGain).connect(out);
    noise.start(t); noise.stop(t + 0.23);

    // "aaaah": sawtooth voice, vowel formants, sliding down with vibrato
    const v0 = t + 0.14, end = v0 + 1.5;
    const voice = ac.createOscillator();
    voice.type = "sawtooth";
    voice.frequency.setValueAtTime(430, v0);
    voice.frequency.exponentialRampToValueAtTime(330, v0 + 0.35);
    voice.frequency.exponentialRampToValueAtTime(130, end);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 6.5;
    const lfoGain = ac.createGain();
    lfoGain.gain.setValueAtTime(4, v0);
    lfoGain.gain.linearRampToValueAtTime(18, end);
    lfo.connect(lfoGain).connect(voice.frequency);

    const vGain = ac.createGain();
    vGain.gain.setValueAtTime(0, v0);
    vGain.gain.linearRampToValueAtTime(0.9, v0 + 0.06);
    vGain.gain.setValueAtTime(0.9, end - 0.45);
    vGain.gain.exponentialRampToValueAtTime(0.001, end);
    for (const [f, q, g] of [[800, 6, 1], [1200, 8, 0.6], [2600, 10, 0.25]] as const) {
      const bp = ac.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
      const fg = ac.createGain(); fg.gain.value = g;
      voice.connect(bp).connect(fg).connect(vGain);
    }
    vGain.connect(out);
    voice.start(v0); lfo.start(v0);
    voice.stop(end + 0.05); lfo.stop(end + 0.05);
  } catch { /* audio unavailable: the pop-up still shows */ }
}

/** An original cartoon: a little shark face-palming with a fin. */
function SadShark() {
  return (
    <svg viewBox="0 0 160 120" width="150" height="112" aria-hidden="true">
      <motion.g animate={{ rotate: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 0.5 }} style={{ originX: "80px", originY: "80px" }}>
        <path d="M14 78 C 30 40, 110 30, 146 70 C 120 102, 40 108, 14 78 Z" fill="#5B7C99" />
        <path d="M30 86 C 60 100, 110 98, 140 74 C 112 92, 60 96, 30 86 Z" fill="#E8EEF3" />
        <path d="M70 40 L 84 6 L 96 40 Z" fill="#5B7C99" />
        <path d="M14 78 L 0 60 L 4 84 Z" fill="#5B7C99" />
        {/* squeezed-shut eye and a tear */}
        <path d="M106 58 l 10 4 l -10 4" stroke="#0E2A3B" strokeWidth="3" fill="none" strokeLinecap="round" />
        <motion.path d="M112 70 q -4 8 0 12 q 4 -4 0 -12" fill="#7FD3E6" animate={{ y: [0, 14], opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.9 }} />
        {/* open "aaah" mouth */}
        <ellipse cx="128" cy="80" rx="8" ry="10" fill="#0E2A3B" />
        <ellipse cx="128" cy="84" rx="5" ry="4" fill="#E86A5C" />
        {/* fin slapped on forehead */}
        <path d="M86 44 C 98 30, 118 34, 122 48 C 110 46, 98 50, 90 58 Z" fill="#456882" />
      </motion.g>
    </svg>
  );
}

const QUIPS = [
  "The sharks are not investing in that flag.",
  "Bold pitch. Wrong answer.",
  "That flag just got recycled.",
  "Even the kelp is disappointed.",
  "I'm out. — every shark, just now",
];

/** Big shaking "FAAAAAA!!!!!!!!" pop-up shown on a wrong flag. Re-triggers whenever `trigger` changes. */
export function FaaahPopup({ trigger }: { trigger: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!trigger) return;
    setShow(true);
    const id = setTimeout(() => setShow(false), 1900);
    return () => clearTimeout(id);
  }, [trigger]);
  const quip = QUIPS[trigger % QUIPS.length];
  return (
    <AnimatePresence>
      {show && (
        <motion.div key={trigger} className="pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-coral/15"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" aria-live="assertive">
          <motion.div className="flex flex-col items-center text-center"
            initial={{ scale: 0.3, rotate: -12 }} animate={{ scale: [0.3, 1.15, 1], rotate: [-12, 6, -2], x: [0, -14, 14, -10, 10, -6, 6, 0] }}
            exit={{ scale: 0.6, opacity: 0, y: 40 }} transition={{ duration: 0.7, x: { duration: 0.6, delay: 0.25 } }}>
            <SadShark />
            <p className="faaah font-display text-[clamp(44px,11vw,120px)] font-black leading-none text-coral">FAAAAAA!!!!!!!!</p>
            <p className="mt-3 rounded-full bg-deep px-4 py-1.5 text-[15px] font-semibold text-white">{quip}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
