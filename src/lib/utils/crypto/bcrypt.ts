import bcrypt from "bcryptjs";

export const MIN_COST = 4;
export const MAX_COST = 15;

export interface BcryptInfo {
  version: string;
  cost: number;
  salt: string;
  hash: string;
}

const BCRYPT_RE = /^\$(2[abxy]?)\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/;

/** Splits a bcrypt hash into its parts: $2b$10$<22-char salt><31-char hash>. */
export function parseBcrypt(hash: string): BcryptInfo | null {
  const m = BCRYPT_RE.exec(hash.trim());
  if (!m) return null;
  const cost = Number(m[2]);
  if (cost < 4 || cost > 31) return null;
  return { version: m[1], cost, salt: m[3], hash: m[4] };
}

export type BcryptHashResult = { ok: true; hash: string } | { ok: false; error: "cost" | "length" };

/** bcrypt only uses the first 72 bytes of the password. */
export function exceedsBcryptLimit(password: string): boolean {
  return new TextEncoder().encode(password).length > 72;
}

export async function bcryptHash(password: string, cost: number): Promise<BcryptHashResult> {
  if (!Number.isInteger(cost) || cost < MIN_COST || cost > MAX_COST) return { ok: false, error: "cost" };
  if (exceedsBcryptLimit(password)) return { ok: false, error: "length" };
  return { ok: true, hash: await bcrypt.hash(password, cost) };
}

export type BcryptCompareResult = { ok: true; match: boolean } | { ok: false; error: "hash" };

export async function bcryptCompare(password: string, hash: string): Promise<BcryptCompareResult> {
  if (!parseBcrypt(hash)) return { ok: false, error: "hash" };
  return { ok: true, match: await bcrypt.compare(password, hash.trim()) };
}
