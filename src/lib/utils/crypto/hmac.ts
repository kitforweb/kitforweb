import { bytesToBase64 } from "../encoding/base64";
import { base64UrlToBytes, bytesToHex } from "../encoding/base64url";

export type HmacAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
export type KeyEncoding = "utf8" | "hex" | "base64";

export type HmacResult = { ok: true; hex: string; base64: string } | { ok: false; error: "key" };

export function decodeKey(key: string, encoding: KeyEncoding): Uint8Array | null {
  if (encoding === "utf8") return new TextEncoder().encode(key);
  const clean = key.trim().replace(/\s+/g, "");
  if (encoding === "hex") {
    if (!/^([0-9a-f]{2})*$/i.test(clean)) return null;
    return new Uint8Array(clean.match(/../g)?.map((h) => parseInt(h, 16)) ?? []);
  }
  try {
    return base64UrlToBytes(clean);
  } catch {
    return null;
  }
}

/** HMAC of a message, in hex and Base64. Empty keys are valid in HMAC. */
export async function hmac(
  message: string,
  key: string,
  algorithm: HmacAlgorithm,
  encoding: KeyEncoding = "utf8",
): Promise<HmacResult> {
  const raw = decodeKey(key, encoding);
  if (!raw) return { ok: false, error: "key" };
  // Web Crypto rejects zero-length HMAC keys; RFC 2104 pads short keys with zeros, so one zero byte is equivalent.
  const keyBytes = raw.length === 0 ? new Uint8Array(1) : raw;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message)));
  return { ok: true, hex: bytesToHex(sig), base64: bytesToBase64(sig) };
}

/**
 * Compares a computed signature with the one received in a webhook header.
 * Accepts "sha256=…" (GitHub), "v1=…" inside "t=…,v1=…" (Stripe), hex or Base64.
 */
export function signatureMatches(expected: string, computed: { hex: string; base64: string }): boolean {
  const candidates = expected
    .split(",")
    .map((part) => part.trim().replace(/^(sha\d+|v\d+)=/i, ""))
    .filter(Boolean);
  return candidates.some((c) => c.toLowerCase() === computed.hex || c === computed.base64);
}
