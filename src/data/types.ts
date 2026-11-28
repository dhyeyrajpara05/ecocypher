// Core data model for EcoCypher. Shared by every backend (browser-local now, server on Vercel later).

export type Role = "player" | "admin";

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  teamId: string | null;
  passwordHash: string;
  passwordSalt: string;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  createdAt: string;
}

/** One of the four challenge categories. Names and colours are editable by admins. */
export interface ChallengeType {
  id: string;
  name: string;
  colour: string;
  description: string;
}

/** Sustainability theme shown on a challenge card. */
export type ThemeKey = "plastics" | "energy" | "water" | "ewaste" | "food" | "climate";

/** A batch of five challenges posted together. Single challenges have no wave. */
export interface Wave {
  id: string;
  number: number;
  createdAt: string;
}

export interface Hint {
  text: string;
  /** Points the team loses when it opens this hint. 0 = free. */
  cost: number;
}

export interface HintUnlock {
  id: string;
  teamId: string;
  userId: string;
  challengeId: string;
  index: number;
  cost: number;
  at: string;
}

export interface ChallengeFile {
  name: string;
  url: string;
}

export interface Challenge {
  id: string;
  waveId: string | null;
  typeId: string;
  theme: ThemeKey;
  title: string;
  description: string;
  points: number;
  flagHash: string;
  flagSalt: string;
  caseSensitive: boolean;
  files: ChallengeFile[];
  hints: Hint[];
  /** Wrong guesses allowed per team. 0 = unlimited. */
  maxAttempts: number;
  hidden: boolean;
  /** null = draft (never shown to players). Players see it from this moment. */
  releaseAt: string | null;
  /** Meme sound/pop-up overrides for this challenge. Missing keys use the event defaults. */
  cues?: Partial<Record<CueKey, Cue>>;
  /** In-browser Python workspace shown in the challenge window, with optional starter code. */
  python?: { enabled: boolean; starter: string };
  /** Set when an admin archives the challenge: out of play and off the scoreboard, but kept. */
  archivedAt?: string | null;
  createdAt: string;
}

/** The moments that can play a meme sound and pop-up. */
export type CueKey = "wrong" | "lastAttempt" | "outOfAttempts" | "correct";
/**
 * What happens at one moment. `sound` is "none", "builtin:<name>" or "upload:<id>".
 * `text` is the big pop-up line (empty = the built-in line). `seconds` stops long clips early.
 */
export interface Cue { sound: string; text: string; seconds: number }
/** An admin-uploaded sound. The audio itself is stored separately and fetched on demand. */
export interface SoundMeta { id: string; name: string; bytes: number; mime: string; addedAt: string }
export interface Soundboard { cues: Record<CueKey, Cue>; sounds: SoundMeta[] }

export interface Submission {
  id: string;
  userId: string;
  teamId: string;
  challengeId: string;
  value: string;
  correct: boolean;
  at: string;
}

export type NoticeLevel = "info" | "important";
export interface Notification {
  id: string;
  title: string;
  body: string;
  level: NoticeLevel;
  at: string;
}

export interface Settings {
  eventName: string;
  tagline: string;
  /** Set when the admin starts the timer. */
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number;
  teamSize: number;
  scoreboardVisible: boolean;
  /** When set, the public scoreboard shows standings as of this moment. */
  freezeAt: string | null;
  submissionsPerMinute: number;
}

export interface DB {
  version: 4;
  soundboard: Soundboard;
  settings: Settings;
  users: User[];
  teams: Team[];
  types: ChallengeType[];
  waves: Wave[];
  challenges: Challenge[];
  submissions: Submission[];
  hintUnlocks: HintUnlock[];
  notifications: Notification[];
  demo: boolean;
  /** Password for the /all-challenge-view testing page (hash only). null/absent = Admin only. */
  tester?: { passwordHash: string; passwordSalt: string } | null;
  /** Sent to the admin instead of `tester`: whether a testing password is set. */
  testerEnabled?: boolean;
  /** Final results (CTF + Shark Tank pitch). Players only receive it once the admin publishes it. */
  finals?: Finals;
}

export interface Judge { id: string; name: string }
/** One team's line on the final results page. */
export interface FinalRow {
  rank: number;
  teamId: string;
  teamName: string;
  members: string[];
  /** CTF points (after hint costs), exactly as on the scoreboard. */
  ctfScore: number;
  /** Average of the judges' pitch scores, or null if no judge scored the team. */
  pitchAvg: number | null;
  /** CTF points + judges' average. Highest wins. */
  combined: number;
}
export interface Finals {
  /** Unused since the final score became CTF points + judges' average. Kept so older saved data still reads. */
  ctfWeight: number;
  /** Highest score a judge can give a pitch. */
  pitchMax: number;
  judges: Judge[];
  /** scores[teamId][judgeId] = that judge's pitch score. */
  scores: Record<string, Record<string, number>>;
  published: boolean;
  publishedAt: string | null;
  /** The standings frozen at the moment of publishing: what players see. */
  snapshot: FinalRow[] | null;
}

export type ReleaseStatus = "draft" | "scheduled" | "live" | "archived";

export interface MemberScore {
  userId: string;
  name: string;
  points: number;
  solves: number;
}

export interface ScoreRow {
  rank: number;
  teamId: string;
  teamName: string;
  score: number;
  solves: number;
  /** Points spent on hints. Already subtracted from score. */
  hintCost: number;
  /** Time the team reached its current score (last solve or hint). Earlier wins ties. */
  lastSolveAt: string | null;
  members: MemberScore[];
  history: { at: string; score: number }[];
}

export interface SubmitResult {
  ok: boolean;
  correct: boolean;
  alreadySolved?: boolean;
  points?: number;
  message: string;
}

/** One challenge as shown on the testing page: everything except the flag. */
export interface TesterChallenge {
  id: string;
  title: string;
  typeId: string;
  theme: ThemeKey;
  points: number;
  status: ReleaseStatus;
  hidden: boolean;
  description: string;
  hints: Hint[];
  files: ChallengeFile[];
  maxAttempts: number;
  caseSensitive: boolean;
  waveNumber: number | null;
  releaseAt: string | null;
  solves: number;
}

export type BulkAction = "release" | "schedule" | "unpublish" | "archive" | "restore" | "delete";
