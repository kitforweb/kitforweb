import { bytesToBase64 } from "../encoding/base64";
import { bytesToHex } from "../encoding/base64url";

export const CHARSETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>/?~",
} as const;

/** Characters easily confused when read or typed: 0 O o, 1 l I |, etc. */
export const AMBIGUOUS = "0Oo1lI|`'\"5S2Z";

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

/** Uniform random integer in [0, max) without modulo bias (rejection sampling). */
export function randomInt(max: number): number {
  if (max <= 0 || max > 2 ** 32) throw new RangeError("max out of range");
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

export function activeSets(o: PasswordOptions): string[] {
  const sets: string[] = [];
  for (const key of ["lower", "upper", "digits", "symbols"] as const) {
    if (!o[key]) continue;
    const set = o.excludeAmbiguous ? [...CHARSETS[key]].filter((c) => !AMBIGUOUS.includes(c)).join("") : CHARSETS[key];
    if (set) sets.push(set);
  }
  return sets;
}

export type PasswordResult = { ok: true; password: string; entropy: number } | { ok: false; error: "sets" | "length" };

/**
 * Cryptographically secure password with at least one character of every
 * selected set, shuffled with Fisher–Yates.
 */
export function generatePassword(o: PasswordOptions): PasswordResult {
  const sets = activeSets(o);
  if (sets.length === 0) return { ok: false, error: "sets" };
  if (!Number.isInteger(o.length) || o.length < sets.length || o.length > 512) return { ok: false, error: "length" };
  const pool = sets.join("");
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < o.length) chars.push(pool[randomInt(pool.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return { ok: true, password: chars.join(""), entropy: entropyBits(o.length, pool.length) };
}

export function entropyBits(length: number, poolSize: number): number {
  return poolSize <= 1 ? 0 : Math.round(length * Math.log2(poolSize));
}

export type Strength = "weak" | "fair" | "strong" | "very-strong";

export function strength(bits: number): Strength {
  if (bits < 50) return "weak";
  if (bits < 80) return "fair";
  if (bits < 120) return "strong";
  return "very-strong";
}

export type SecretFormat = "hex" | "base64" | "base64url";

/** Random secret of `bytes` bytes for .env files (session secrets, API keys…). */
export function generateSecret(bytes: number, format: SecretFormat): string {
  const raw = crypto.getRandomValues(new Uint8Array(Math.max(1, Math.min(1024, Math.floor(bytes)))));
  return format === "hex" ? bytesToHex(raw) : bytesToBase64(raw, format === "base64url");
}
