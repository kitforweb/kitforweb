import { v4, v7 } from "uuid";

export type UuidVersion = 4 | 7;

export interface UuidFormat {
  uppercase: boolean;
  hyphens: boolean;
  braces: boolean;
}

export function formatUuid(id: string, { uppercase, hyphens, braces }: UuidFormat): string {
  let out = hyphens ? id : id.replace(/-/g, "");
  if (uppercase) out = out.toUpperCase();
  return braces ? `{${out}}` : out;
}

/** Generates `count` UUIDs (v4 random, v7 time-ordered). */
export function generateUuids(version: UuidVersion, count: number, format: UuidFormat): string[] {
  const n = Math.max(1, Math.min(1000, Math.floor(count) || 1));
  return Array.from({ length: n }, () => formatUuid(version === 4 ? v4() : v7(), format));
}

export interface UuidInfo {
  /** Canonical lowercase form with hyphens. */
  canonical: string;
  version: number;
  variant: "NCS" | "RFC 9562" | "Microsoft" | "Future";
  special?: "nil" | "max";
  /** Creation time for time-based versions (1, 6, 7). */
  timestamp?: Date;
}

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

// Offset between the Gregorian epoch (1582-10-15) and the Unix epoch, in 100-ns intervals.
const GREGORIAN_OFFSET = BigInt("122192928000000000");

/** Validates a UUID (with or without hyphens/braces) and tells its version, variant and time. */
export function inspectUuid(input: string): UuidInfo | null {
  const text = input
    .trim()
    .replace(/^[{(]|[})]$/g, "")
    .replace(/^urn:uuid:/i, "");
  if (!UUID_RE.test(text)) return null;
  const hex = text.replace(/-/g, "").toLowerCase();
  const canonical = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  if (/^0+$/.test(hex)) return { canonical, version: 0, variant: "NCS", special: "nil" };
  if (/^f+$/.test(hex)) return { canonical, version: 15, variant: "Future", special: "max" };

  const version = parseInt(hex[12], 16);
  const v = parseInt(hex[16], 16);
  const variant = v < 8 ? "NCS" : v < 12 ? "RFC 9562" : v < 14 ? "Microsoft" : "Future";
  let timestamp: Date | undefined;
  if (version === 7) {
    timestamp = new Date(parseInt(hex.slice(0, 12), 16));
  } else if (version === 1 || version === 6) {
    const t =
      version === 1
        ? BigInt(`0x${hex.slice(13, 16)}${hex.slice(8, 12)}${hex.slice(0, 8)}`)
        : BigInt(`0x${hex.slice(0, 12)}${hex.slice(13, 16)}`);
    timestamp = new Date(Number((t - GREGORIAN_OFFSET) / BigInt(10000)));
  }
  return { canonical, version, variant, ...(timestamp ? { timestamp } : {}) };
}
