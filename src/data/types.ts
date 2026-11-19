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
  createdAt: string;
}

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
  version: 3;
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
}

export type ReleaseStatus = "draft" | "scheduled" | "live";

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
