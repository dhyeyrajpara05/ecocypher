import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

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
let clip: HTMLAudioElement | null = null;

/** Plays the "FAAAAH" sound file. Falls back to a synthesised version if the file can't play. */
export function playFaaah() {
  if (isMuted()) return;
  try {
    clip ??= new Audio(`${import.meta.env.BASE_URL}sounds/faaah.mp3`);
    clip.currentTime = 0;
    clip.volume = 0.9;
    void clip.play().catch(synthFaaah);
  } catch { synthFaaah(); }
}

/** Warms up the sound file so the first wrong flag plays instantly. */
export function preloadFaaah() {
  try { clip ??= new Audio(`${import.meta.env.BASE_URL}sounds/faaah.mp3`); clip.preload = "auto"; } catch { /* no audio */ }
}

function synthFaaah() {
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

type Mood = "wrong" | "lastAttempt" | "outOfAttempts";

/** Original cartoon shark in three moods: face-palming, sweating, knocked out. */
function MoodShark({ mood }: { mood: Mood }) {
  const body = mood === "outOfAttempts" ? "#4A5560" : "#5B7C99";
  return (
    <svg viewBox="0 0 160 120" width="150" height="112" aria-hidden="true">
      <motion.g animate={mood === "outOfAttempts" ? { rotate: [0, -8, -8] } : { rotate: [-3, 3, -3] }}
        transition={mood === "outOfAttempts" ? { duration: 0.8 } : { repeat: Infinity, duration: mood === "lastAttempt" ? 0.18 : 0.5 }}
        style={{ originX: "80px", originY: "80px" }}>
        <path d="M14 78 C 30 40, 110 30, 146 70 C 120 102, 40 108, 14 78 Z" fill={body} />
        <path d="M30 86 C 60 100, 110 98, 140 74 C 112 92, 60 96, 30 86 Z" fill="#E8EEF3" />
        <path d="M70 40 L 84 6 L 96 40 Z" fill={body} />
        <path d="M14 78 L 0 60 L 4 84 Z" fill={body} />
        {mood === "wrong" && <>
          <path d="M106 58 l 10 4 l -10 4" stroke="#0E2A3B" strokeWidth="3" fill="none" strokeLinecap="round" />
          <motion.path d="M112 70 q -4 8 0 12 q 4 -4 0 -12" fill="#7FD3E6" animate={{ y: [0, 14], opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.9 }} />
          <ellipse cx="128" cy="80" rx="8" ry="10" fill="#0E2A3B" /><ellipse cx="128" cy="84" rx="5" ry="4" fill="#E86A5C" />
          <path d="M86 44 C 98 30, 118 34, 122 48 C 110 46, 98 50, 90 58 Z" fill="#456882" />
        </>}
        {mood === "lastAttempt" && <>
          <circle cx="112" cy="60" r="7" fill="#fff" /><circle cx="114" cy="61" r="3" fill="#0E2A3B" />
          <path d="M120 82 q 6 -5 12 0" stroke="#0E2A3B" strokeWidth="3" fill="none" strokeLinecap="round" />
          {[0, 1, 2].map((i) => (
            <motion.path key={i} d={`M${96 + i * 14} 36 q -3 6 0 9 q 3 -3 0 -9`} fill="#7FD3E6"
              animate={{ y: [0, 18], opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.2 }} />
          ))}
        </>}
        {mood === "outOfAttempts" && <>
          <path d="M106 54 l 12 12 M118 54 l -12 12" stroke="#0E2A3B" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M120 84 q 6 3 12 0" stroke="#0E2A3B" strokeWidth="3" fill="none" strokeLinecap="round" />
          <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }} style={{ originX: "112px", originY: "34px" }}>
            {[0, 120, 240].map((a) => <text key={a} x={112 + 16 * Math.cos((a * Math.PI) / 180)} y={38 + 8 * Math.sin((a * Math.PI) / 180)} fontSize="12" fill="#E2B13C">★</text>)}
          </motion.g>
        </>}
      </motion.g>
    </svg>
  );
}

const QUIPS: Record<Mood, string[]> = {
  wrong: [
    "The sharks are not investing in that flag.",
    "Bold pitch. Wrong answer.",
    "That flag just got recycled.",
    "Even the kelp is disappointed.",
    "I'm out. (every shark, just now)",
  ],
  lastAttempt: [
    "One attempt left. Make it count.",
    "Last chance. No pressure. (Lots of pressure.)",
    "One shot. Read the question again.",
  ],
  outOfAttempts: [
    "No attempts left on this one. Move on, champ.",
    "The sharks have left the room.",
    "This deal is closed. Try another challenge.",
  ],
};

const STYLE: Record<Mood, { overlay: string; text: string; pill: string }> = {
  wrong: { overlay: "bg-coral/15", text: "text-coral", pill: "bg-deep text-white" },
  lastAttempt: { overlay: "bg-brass/20", text: "text-brass", pill: "bg-coral text-white" },
  outOfAttempts: { overlay: "bg-deep/70", text: "text-fin-200", pill: "bg-white text-deep" },
};
export const DEFAULT_TEXT: Record<Mood, string> = { wrong: "FAAAAAA!!!!!!!!", lastAttempt: "ABHI MAZA AAYEGA!", outOfAttempts: "GAME OVER" };

/** Calls `fn` only when `trigger` goes up after the component has mounted, never on (re)mount. */
export function useOnBump(trigger: number, fn: () => void | (() => void)) {
  const last = useRef(trigger);
  useEffect(() => {
    if (trigger <= last.current) { last.current = trigger; return; }
    last.current = trigger;
    return fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
}

/** Big shaking meme pop-up, shown once per trigger. */
export function MemePopup({ trigger, mood, text }: { trigger: number; mood: Mood; text?: string }) {
  const [show, setShow] = useState(false);
  useOnBump(trigger, () => {
    setShow(true);
    const id = setTimeout(() => setShow(false), mood === "wrong" ? 2200 : 3000);
    return () => clearTimeout(id);
  });
  const st = STYLE[mood];
  const quip = QUIPS[mood][trigger % QUIPS[mood].length];
  return (
    <AnimatePresence>
      {show && (
        <motion.div key={trigger} className={`pointer-events-none fixed inset-0 z-[80] grid place-items-center ${st.overlay}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" aria-live="assertive">
          <motion.div className="flex flex-col items-center px-4 text-center"
            initial={{ scale: 0.3, rotate: -12 }}
            animate={mood === "outOfAttempts" ? { scale: [0.3, 1.1, 1], rotate: [-12, 0, 0], y: [0, 0, 8] } : { scale: [0.3, 1.15, 1], rotate: [-12, 6, -2], x: [0, -14, 14, -10, 10, -6, 6, 0] }}
            exit={{ scale: 0.6, opacity: 0, y: 40 }} transition={{ duration: 0.7, x: { duration: 0.6, delay: 0.25 } }}>
            <MoodShark mood={mood} />
            <p className={`faaah font-display text-[clamp(40px,10vw,112px)] font-black leading-none ${st.text}`}>{text?.trim() || DEFAULT_TEXT[mood]}</p>
            <p className={`mt-3 rounded-full px-4 py-1.5 text-[15px] font-semibold ${st.pill}`}>{quip}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Kept for older call sites: the wrong-flag pop-up. */
export function FaaahPopup({ trigger }: { trigger: number }) {
  return <MemePopup trigger={trigger} mood="wrong" />;
}

// ---------------------------------------------------------------- cue playback
const clips = new Map<string, HTMLAudioElement>();
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let playing: HTMLAudioElement | null = null;

/** Loads a clip ahead of time so it starts instantly. */
export function preloadSound(src: string | null) {
  if (!src || clips.has(src)) return;
  try { const a = new Audio(src); a.preload = "auto"; clips.set(src, a); } catch { /* no audio */ }
}

/**
 * Plays a sound for at most `seconds`, fading out at the end. `src` null means a generated sound
 * (`synth`) or nothing. Respects the player's mute switch. Stops whatever was playing before.
 */
export function playSound(src: string | null, seconds: number, synth?: () => void) {
  if (isMuted()) return;
  if (playing) { playing.pause(); playing = null; }
  if (stopTimer) clearTimeout(stopTimer);
  if (!src) { synth?.(); return; }
  try {
    let a = clips.get(src);
    if (!a) { a = new Audio(src); clips.set(src, a); }
    a.currentTime = 0;
    a.volume = 0.9;
    playing = a;
    void a.play().catch(() => synth?.());
    stopTimer = setTimeout(() => {
      const el = a!;
      let v = el.volume;
      const fade = setInterval(() => {
        v -= 0.1;
        if (v <= 0.05) { clearInterval(fade); el.pause(); } else el.volume = v;
      }, 40);
    }, Math.max(1, seconds) * 1000);
  } catch { synth?.(); }
}
