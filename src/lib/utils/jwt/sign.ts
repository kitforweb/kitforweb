import {
  exportJWK,
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  generateSecret,
  importJWK,
  importPKCS8,
  SignJWT,
  type JWK,
  type JWTPayload,
} from "jose";
import { bytesToBase64 } from "../encoding/base64";

export const jwtAlgorithms = [
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA",
] as const;
export type JwtAlgorithm = (typeof jwtAlgorithms)[number];

export const isHmac = (alg: JwtAlgorithm) => alg.startsWith("HS");

export interface SignRequest {
  alg: JwtAlgorithm;
  payload: string;
  /** HMAC secret, or private key as PKCS#8 PEM or JWK. */
  key: string;
  /** Adds `iat` (now) when the payload does not have it. */
  issuedAt?: boolean;
  /** Seconds until `exp`, when the payload does not set it. */
  expiresIn?: number;
  typ?: string;
  kid?: string;
}

export type SignResult = { ok: true; token: string } | { ok: false; error: "payload" | "key" | "secret" };

function parsePayload(text: string): JWTPayload | null {
  try {
    const v: unknown = JSON.parse(text);
    return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as JWTPayload) : null;
  } catch {
    return null;
  }
}

/** Creates and signs a JWT (JWS compact serialisation). */
export async function signJwt(req: SignRequest, now = Math.floor(Date.now() / 1000)): Promise<SignResult> {
  const payload = parsePayload(req.payload);
  if (!payload) return { ok: false, error: "payload" };
  if (req.issuedAt && payload.iat === undefined) payload.iat = now;
  if (req.expiresIn && payload.exp === undefined) payload.exp = now + req.expiresIn;

  let key: Uint8Array | CryptoKey;
  try {
    if (isHmac(req.alg)) {
      if (!req.key) return { ok: false, error: "secret" };
      key = new TextEncoder().encode(req.key);
    } else {
      const text = req.key.trim();
      const imported = text.startsWith("{")
        ? await importJWK(JSON.parse(text) as JWK, req.alg)
        : await importPKCS8(text, req.alg);
      if (imported instanceof Uint8Array) return { ok: false, error: "key" };
      key = imported as CryptoKey;
    }
  } catch {
    return { ok: false, error: "key" };
  }

  try {
    const header = { alg: req.alg, typ: req.typ ?? "JWT", ...(req.kid ? { kid: req.kid } : {}) };
    const token = await new SignJWT(payload).setProtectedHeader(header).sign(key);
    return { ok: true, token };
  } catch {
    return { ok: false, error: "key" };
  }
}

export interface DemoKeys {
  /** Secret (HMAC) or PKCS#8 private key. */
  privateKey: string;
  /** Empty for HMAC; SPKI public key otherwise. */
  publicKey: string;
  publicJwk?: string;
}

/** Random secret or key pair to try the generator, created locally with Web Crypto. */
export async function generateDemoKeys(alg: JwtAlgorithm): Promise<DemoKeys> {
  if (isHmac(alg)) {
    const bits = Number(alg.slice(2));
    const secret = (await generateSecret(alg, { extractable: true })) as CryptoKey;
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", secret));
    return { privateKey: bytesToBase64(raw.slice(0, bits / 8), true), publicKey: "" };
  }
  const { privateKey, publicKey } = await generateKeyPair(alg, {
    extractable: true,
    crv: alg === "EdDSA" ? "Ed25519" : undefined,
  });
  return {
    privateKey: await exportPKCS8(privateKey),
    publicKey: await exportSPKI(publicKey),
    publicJwk: JSON.stringify({ ...(await exportJWK(publicKey)), alg }, null, 2),
  };
}
