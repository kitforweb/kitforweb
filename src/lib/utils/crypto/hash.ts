import SparkMD5 from "spark-md5";
import { bytesToBase64 } from "../encoding/base64";
import { bytesToHex } from "../encoding/base64url";

export const hashAlgorithms = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
export type HashAlgorithm = (typeof hashAlgorithms)[number];

export interface Digest {
  algorithm: HashAlgorithm;
  hex: string;
  base64: string;
}

async function digestBytes(algorithm: HashAlgorithm, bytes: Uint8Array): Promise<Uint8Array> {
  if (algorithm === "MD5") {
    const hex = SparkMD5.ArrayBuffer.hash(bytes.slice().buffer as ArrayBuffer);
    return new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));
  }
  return new Uint8Array(await crypto.subtle.digest(algorithm, bytes as BufferSource));
}

/** Every hash at once (MD5 is not in Web Crypto, so it uses spark-md5). */
export async function hashAll(input: Uint8Array | string): Promise<Digest[]> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  return Promise.all(
    hashAlgorithms.map(async (algorithm) => {
      const d = await digestBytes(algorithm, bytes);
      return { algorithm, hex: bytesToHex(d), base64: bytesToBase64(d) };
    }),
  );
}

/** Subresource Integrity value for a <script integrity="…"> attribute. */
export function sriFromDigest(d: Digest): string | null {
  return d.algorithm.startsWith("SHA-") && d.algorithm !== "SHA-1"
    ? `${d.algorithm.toLowerCase().replace("-", "")}-${d.base64}`
    : null;
}

/**
 * Finds which digest an expected value corresponds to: hex (any case), Base64
 * or SRI ("sha384-…"). Spaces and "algo:" prefixes are ignored.
 */
export function findMatch(digests: Digest[], expected: string): HashAlgorithm | null {
  const value = expected.trim().replace(/\s+/g, "");
  if (!value) return null;
  const sri = /^(sha256|sha384|sha512)-(.+)$/i.exec(value);
  const clean = (sri ? sri[2] : value).replace(/^[a-z0-9-]+:/i, "");
  for (const d of digests) {
    if (d.hex === clean.toLowerCase() || d.base64 === clean) return d.algorithm;
  }
  return null;
}
