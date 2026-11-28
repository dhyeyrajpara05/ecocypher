// Hashing helpers (Web Crypto, works in browsers and Node 18+).
//
// Flags and passwords are never stored. Only salted PBKDF2-SHA256 hashes are kept, so even someone
// who reads the stored data cannot turn a hash back into the flag; guessing is slowed to a few
// guesses per second per CPU core.

const enc = new TextEncoder();
export const FLAG_ITERATIONS = 150_000;
export const PASSWORD_ITERATIONS = 150_000;

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomId(prefix = ""): string {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return prefix + [...a].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

export function randomSalt(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return hex(a.buffer);
}

/** Readable temporary password, e.g. "kelp-reef-gull-moss-4821" (4 words from 14 + 4 digits, about 345 million combinations). */
export function tempPassword(): string {
  const words = ["kelp", "reef", "tide", "fin", "coral", "drift", "shoal", "brine", "gull", "dune", "moss", "fern", "pearl", "wave"];
  const a = new Uint32Array(5);
  crypto.getRandomValues(a);
  return `${words[a[0] % words.length]}-${words[a[1] % words.length]}-${words[a[2] % words.length]}-${words[a[3] % words.length]}-${1000 + (a[4] % 9000)}`;
}

async function pbkdf2(secret: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations }, key, 256);
  return hex(bits);
}

export function hashPassword(password: string, salt: string): Promise<string> {
  return pbkdf2(password, salt, PASSWORD_ITERATIONS);
}

export function normaliseFlag(value: string, caseSensitive: boolean): string {
  const v = value.trim();
  return caseSensitive ? v : v.toLowerCase();
}

export function hashFlag(value: string, salt: string, caseSensitive: boolean): Promise<string> {
  return pbkdf2(normaliseFlag(value, caseSensitive), `flag:${salt}`, FLAG_ITERATIONS);
}

/** Constant-time string comparison for hashes. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
