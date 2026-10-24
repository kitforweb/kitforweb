import { base64UrlToText } from "../encoding/base64url";

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: unknown;
  signature: string;
  /** `header.payload`, the bytes that were signed. */
  signingInput: string;
}

export type JwtDecodeError = "parts" | "header" | "payload";

export type JwtDecodeResult = { ok: true; jwt: DecodedJwt } | { ok: false; error: JwtDecodeError };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Strips an optional `Bearer ` prefix and surrounding whitespace. */
export function cleanToken(input: string): string {
  return input.trim().replace(/^bearer\s+/i, "");
}

export function decodeJwt(input: string): JwtDecodeResult {
  const token = cleanToken(input);
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "parts" };
  const [h, p, s] = parts;

  let header: unknown;
  try {
    header = JSON.parse(base64UrlToText(h));
  } catch {
    return { ok: false, error: "header" };
  }
  if (!isObject(header)) return { ok: false, error: "header" };

  let payload: unknown;
  try {
    const text = base64UrlToText(p);
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text; // JWS payloads don't have to be JSON
    }
  } catch {
    return { ok: false, error: "payload" };
  }

  return { ok: true, jwt: { header, payload, signature: s, signingInput: `${h}.${p}` } };
}

export type TimeClaim = "exp" | "iat" | "nbf";

export interface ClaimTime {
  claim: TimeClaim;
  seconds: number;
  date: Date;
}

export function timeClaims(payload: unknown): ClaimTime[] {
  if (!isObject(payload)) return [];
  const out: ClaimTime[] = [];
  for (const claim of ["iat", "nbf", "exp"] as const) {
    const v = payload[claim];
    if (typeof v === "number" && Number.isFinite(v)) {
      out.push({ claim, seconds: v, date: new Date(v * 1000) });
    }
  }
  return out;
}

export type JwtStatus = "valid" | "expired" | "not-yet-valid" | "no-expiry";

export function jwtStatus(payload: unknown, now: Date = new Date()): JwtStatus {
  if (!isObject(payload)) return "no-expiry";
  const t = now.getTime() / 1000;
  if (typeof payload.nbf === "number" && payload.nbf > t) return "not-yet-valid";
  if (typeof payload.exp !== "number") return "no-expiry";
  return payload.exp <= t ? "expired" : "valid";
}
