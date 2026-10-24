import { compactVerify, importJWK, importSPKI, importX509, type CryptoKey, type JWK, type KeyObject } from "jose";
import { cleanToken } from "./decode";

export type VerifyResult = { ok: true } | { ok: false; reason: "signature" | "key" | "alg" };

const SYMMETRIC = /^HS(256|384|512)$/;

async function resolveKey(alg: string, key: string): Promise<CryptoKey | KeyObject | Uint8Array> {
  if (SYMMETRIC.test(alg)) return new TextEncoder().encode(key);
  const trimmed = key.trim();
  if (trimmed.startsWith("{")) return importJWK(JSON.parse(trimmed) as JWK, alg);
  if (trimmed.includes("BEGIN CERTIFICATE")) return importX509(trimmed, alg);
  return importSPKI(trimmed, alg);
}

/**
 * Verifies the signature only (no claim checks). `key` is the shared secret
 * for HS* algorithms, or a PEM public key / certificate / JWK otherwise.
 */
export async function verifyJwt(token: string, alg: string, key: string): Promise<VerifyResult> {
  if (alg === "none") return { ok: false, reason: "alg" };
  let resolved: CryptoKey | KeyObject | Uint8Array;
  try {
    resolved = await resolveKey(alg, key);
  } catch {
    return { ok: false, reason: "key" };
  }
  try {
    await compactVerify(cleanToken(token), resolved, { algorithms: [alg] });
    return { ok: true };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ERR_JOSE_ALG_NOT_ALLOWED" || code === "ERR_JOSE_NOT_SUPPORTED") {
      return { ok: false, reason: "alg" };
    }
    if (code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") return { ok: false, reason: "signature" };
    return { ok: false, reason: "key" };
  }
}

export function isSymmetricAlg(alg: string): boolean {
  return SYMMETRIC.test(alg);
}
