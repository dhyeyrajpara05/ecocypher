/** Built-in sounds and the default meme moments. Shared by the server and the browser. */
import type { Cue, CueKey, Soundboard } from "./types";

export const BUILTIN_SOUNDS: { ref: string; name: string; file?: string }[] = [
  { ref: "builtin:faaah", name: "FAAAAH", file: "sounds/faaah.mp3" },
  { ref: "builtin:abhi-maza", name: "Abhi maza aayega", file: "sounds/abhi-maza.mp3" },
  { ref: "builtin:game-over", name: "Game over", file: "sounds/game-over.mp3" },
  { ref: "builtin:deal", name: "Deal cha-ching (generated)" },
];

export const CUE_LABELS: Record<CueKey, { title: string; when: string; defaultText: string }> = {
  wrong: { title: "Wrong flag", when: "Any wrong guess (when more than one attempt is left, or attempts are unlimited)", defaultText: "FAAAAAA!!!!!!!!" },
  lastAttempt: { title: "Last attempt left", when: "A wrong guess that leaves the team exactly one attempt", defaultText: "ABHI MAZA AAYEGA!" },
  outOfAttempts: { title: "Out of attempts", when: "The wrong guess that uses the team's final attempt", defaultText: "GAME OVER" },
  correct: { title: "Correct flag", when: "The team captures the flag", defaultText: "DEAL!" },
};
export const CUE_KEYS = Object.keys(CUE_LABELS) as CueKey[];

export function defaultSoundboard(): Soundboard {
  return {
    cues: {
      wrong: { sound: "builtin:faaah", text: "", seconds: 4 },
      lastAttempt: { sound: "builtin:abhi-maza", text: "", seconds: 6 },
      outOfAttempts: { sound: "builtin:game-over", text: "", seconds: 8 },
      correct: { sound: "builtin:deal", text: "", seconds: 3 },
    },
    sounds: [],
  };
}

/** The cue that applies to a challenge: its own override, else the event default. */
export function cueFor(board: Soundboard, cues: Partial<Record<CueKey, Cue>> | undefined, key: CueKey): Cue {
  return cues?.[key] ?? board.cues[key];
}

export const MAX_SOUND_BYTES = 600 * 1024;
