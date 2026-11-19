// Hashing helpers (Web Crypto, works in browsers and Node 18+).

const enc = new TextEncoder();

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

/** Readable temporary password, e.g. "kelp-reef-4821". */
export function tempPassword(): string {
  const words = ["kelp", "reef", "tide", "fin", "coral", "drift", "shoal", "brine", "gull", "dune", "moss", "fern", "pearl", "wave"];
  const a = new Uint32Array(3);
  crypto.getRandomValues(a);
  return `${words[a[0] % words.length]}-${words[a[1] % words.length]}-${1000 + (a[2] % 9000)}`;
}

export async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 120_000 }, key, 256);
  return hex(bits);
}

export function normaliseFlag(value: string, caseSensitive: boolean): string {
  const v = value.trim();
  return caseSensitive ? v : v.toLowerCase();
}

export async function hashFlag(value: string, salt: string, caseSensitive: boolean): Promise<string> {
  return sha256(`${salt}:${normaliseFlag(value, caseSensitive)}`);
}
