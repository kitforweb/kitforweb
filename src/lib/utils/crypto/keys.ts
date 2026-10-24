import { exportJWK, exportPKCS8, exportSPKI, importJWK, importPKCS8, importSPKI, type JWK } from "jose";

export type KeyType = "RSA" | "EC" | "Ed25519";
export type RsaSize = 2048 | 3072 | 4096;
export type Curve = "P-256" | "P-384" | "P-521";

export interface KeyPairOptions {
  type: KeyType;
  rsaSize?: RsaSize;
  curve?: Curve;
}

export interface ExportedKeyPair {
  privatePem: string;
  publicPem: string;
  privateJwk: JWK;
  publicJwk: JWK;
}

const CURVE_ALG: Record<Curve, string> = { "P-256": "ES256", "P-384": "ES384", "P-521": "ES512" };

function algorithmFor(o: KeyPairOptions): RsaHashedKeyGenParams | EcKeyGenParams | { name: "Ed25519" } {
  if (o.type === "RSA") {
    return {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: o.rsaSize ?? 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    };
  }
  if (o.type === "EC") return { name: "ECDSA", namedCurve: o.curve ?? "P-256" };
  return { name: "Ed25519" };
}

/** Generates a key pair with Web Crypto and exports it as PEM (PKCS#8 / SPKI) and JWK. */
export async function generateKeyPairPem(o: KeyPairOptions): Promise<ExportedKeyPair> {
  const pair = (await crypto.subtle.generateKey(algorithmFor(o), true, ["sign", "verify"])) as CryptoKeyPair;
  const alg = o.type === "RSA" ? "RS256" : o.type === "EC" ? CURVE_ALG[o.curve ?? "P-256"] : "EdDSA";
  return {
    privatePem: await exportPKCS8(pair.privateKey),
    publicPem: await exportSPKI(pair.publicKey),
    privateJwk: { ...(await exportJWK(pair.privateKey)), alg },
    publicJwk: { ...(await exportJWK(pair.publicKey)), alg },
  };
}

// Algorithms tried, in order, when importing a PEM whose type is unknown.
const CANDIDATES = ["RS256", "ES256", "ES384", "ES512", "EdDSA"];

export type ConvertKeyResult =
  { ok: true; output: string; kind: "public" | "private" } | { ok: false; error: "format" | "key" };

/** PEM (public SPKI or private PKCS#8) → JWK. */
export async function pemToJwk(pem: string): Promise<ConvertKeyResult> {
  const text = pem.trim();
  const isPrivate = /-----BEGIN PRIVATE KEY-----/.test(text);
  const isPublic = /-----BEGIN PUBLIC KEY-----/.test(text);
  if (!isPrivate && !isPublic) return { ok: false, error: "format" };
  for (const alg of CANDIDATES) {
    try {
      const key = isPrivate
        ? await importPKCS8(text, alg, { extractable: true })
        : await importSPKI(text, alg, { extractable: true });
      const jwk = await exportJWK(key);
      return { ok: true, output: JSON.stringify({ ...jwk, alg }, null, 2), kind: isPrivate ? "private" : "public" };
    } catch {
      // try the next algorithm
    }
  }
  return { ok: false, error: "key" };
}

function algForJwk(jwk: JWK): string | null {
  if (jwk.alg) return jwk.alg;
  if (jwk.kty === "RSA") return "RS256";
  if (jwk.kty === "EC" && jwk.crv) return CURVE_ALG[jwk.crv as Curve] ?? null;
  if (jwk.kty === "OKP" && jwk.crv === "Ed25519") return "EdDSA";
  return null;
}

/** JWK → PEM (PKCS#8 when the JWK contains the private part "d"). */
export async function jwkToPem(json: string): Promise<ConvertKeyResult> {
  let jwk: JWK;
  try {
    jwk = JSON.parse(json) as JWK;
  } catch {
    return { ok: false, error: "format" };
  }
  if (!jwk || typeof jwk !== "object" || !jwk.kty) return { ok: false, error: "format" };
  const alg = algForJwk(jwk);
  if (!alg) return { ok: false, error: "key" };
  try {
    const key = await importJWK(jwk, alg, { extractable: true });
    if (key instanceof Uint8Array) return { ok: false, error: "key" };
    const isPrivate = "d" in jwk;
    return {
      ok: true,
      output: isPrivate ? await exportPKCS8(key) : await exportSPKI(key),
      kind: isPrivate ? "private" : "public",
    };
  } catch {
    return { ok: false, error: "key" };
  }
}
