// @peculiar/x509 uses tsyringe, which needs this polyfill before it loads.
import "reflect-metadata";
import {
  BasicConstraintsExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
  SubjectAlternativeNameExtension,
  X509Certificate,
} from "@peculiar/x509";
import { bytesToHex } from "../encoding/base64url";

export type CertStatus = "valid" | "expired" | "not-yet-valid";

export interface CertInfo {
  subject: string;
  commonName?: string;
  issuer: string;
  selfSigned: boolean;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  status: CertStatus;
  /** Whole days until expiry (negative when expired). */
  daysLeft: number;
  dnsNames: string[];
  ipAddresses: string[];
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  publicKeySize?: number;
  isCA: boolean;
  keyUsages: string[];
  sha256: string;
  sha1: string;
}

const PEM_RE = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

/** Extracts every certificate block from a PEM bundle (a chain has several). */
export function splitPem(text: string): string[] {
  return text.match(PEM_RE) ?? [];
}

const colonHex = (bytes: ArrayBuffer) =>
  bytesToHex(new Uint8Array(bytes))
    .toUpperCase()
    .replace(/(..)(?=.)/g, "$1:");

const DAY = 86_400_000;

function usages(flags: number): string[] {
  return (Object.entries(KeyUsageFlags) as [string, string | number][])
    .filter(([name, bit]) => typeof bit === "number" && bit > 0 && (flags & bit) === bit && Number.isNaN(Number(name)))
    .map(([name]) => name);
}

function describeAlgorithm(alg: Algorithm & { hash?: Algorithm | string; namedCurve?: string }): string {
  const hash = typeof alg.hash === "string" ? alg.hash : alg.hash?.name;
  return [alg.name, alg.namedCurve, hash].filter(Boolean).join(" · ");
}

export async function parseCertificate(pem: string, now: Date = new Date()): Promise<CertInfo> {
  const cert = new X509Certificate(pem);
  const san = cert.getExtension(SubjectAlternativeNameExtension);
  const names = san?.names.toJSON() ?? [];
  const basic = cert.getExtension(BasicConstraintsExtension);
  const ku = cert.getExtension(KeyUsagesExtension);
  const keyAlg = cert.publicKey.algorithm as Algorithm & { modulusLength?: number; namedCurve?: string };
  const status: CertStatus = now < cert.notBefore ? "not-yet-valid" : now > cert.notAfter ? "expired" : "valid";

  return {
    subject: cert.subject,
    commonName: /(?:^|,\s*)CN=([^,]+)/.exec(cert.subject)?.[1],
    issuer: cert.issuer,
    selfSigned: cert.subject === cert.issuer,
    serialNumber: cert.serialNumber.toUpperCase(),
    notBefore: cert.notBefore,
    notAfter: cert.notAfter,
    status,
    daysLeft: Math.floor((cert.notAfter.getTime() - now.getTime()) / DAY),
    dnsNames: names.filter((n) => n.type === "dns").map((n) => n.value),
    ipAddresses: names.filter((n) => n.type === "ip").map((n) => n.value),
    signatureAlgorithm: describeAlgorithm(cert.signatureAlgorithm as Algorithm),
    publicKeyAlgorithm: [keyAlg.name, keyAlg.namedCurve].filter(Boolean).join(" "),
    publicKeySize: keyAlg.modulusLength,
    isCA: basic?.ca ?? false,
    keyUsages: ku ? usages(ku.usages) : [],
    sha256: colonHex(await cert.getThumbprint("SHA-256")),
    sha1: colonHex(await cert.getThumbprint("SHA-1")),
  };
}

export type ParseCertsResult =
  { ok: true; certs: CertInfo[] } | { ok: false; error: "none" | "invalid"; index?: number };

/** Parses a single certificate or a whole chain. */
export async function parseCertificates(text: string, now?: Date): Promise<ParseCertsResult> {
  const blocks = splitPem(text);
  if (blocks.length === 0) return { ok: false, error: "none" };
  const certs: CertInfo[] = [];
  for (let i = 0; i < blocks.length; i++) {
    try {
      certs.push(await parseCertificate(blocks[i], now));
    } catch {
      return { ok: false, error: "invalid", index: i + 1 };
    }
  }
  return { ok: true, certs };
}
