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

/** A funding round = a wave of challenges released together. */
export type RoundState = "draft" | "scheduled" | "closed";
export interface Round {
  id: string;
  name: string;
  order: number;
  state: RoundState;
  opensAt: string | null;
  closesAt: string | null;
}

export interface ChallengeFile {
  name: string;
  url: string;
}

export interface Challenge {
  id: string;
  roundId: string;
  typeId: string;
  title: string;
  description: string;
  points: number;
  flagHash: string;
  flagSalt: string;
  caseSensitive: boolean;
  files: ChallengeFile[];
  hint: string;
  hidden: boolean;
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

export interface Announcement {
  id: string;
  text: string;
  at: string;
}

export interface Settings {
  eventName: string;
  tagline: string;
  startsAt: string | null;
  endsAt: string | null;
  scoreboardVisible: boolean;
  /** When set, the public scoreboard shows standings as of this moment. */
  freezeAt: string | null;
  submissionsPerMinute: number;
}

export interface DB {
  version: 1;
  settings: Settings;
  users: User[];
  teams: Team[];
  types: ChallengeType[];
  rounds: Round[];
  challenges: Challenge[];
  submissions: Submission[];
  announcements: Announcement[];
  demo: boolean;
}

export type RoundStatus = "draft" | "upcoming" | "open" | "closed";

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
  /** Time the team reached its current score. Earlier wins ties. */
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
