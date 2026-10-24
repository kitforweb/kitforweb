import { detectBase64, detectJwt } from "../detect/detectors";
import { base64UrlToText } from "./base64url";

export type ValueKind = "json" | "jwt" | "base64" | "url" | null;

export interface UrlParam {
  key: string;
  value: string;
  /** Position among the parameters with the same key (repeated keys). */
  occurrence: number;
  kind: ValueKind;
  /** Decoded Base64 text, pretty JSON or parsed nested URL. */
  preview?: string;
  nested?: ParsedUrl;
}

export interface ParsedUrl {
  href: string;
  protocol: string;
  host: string;
  pathname: string;
  params: UrlParam[];
  /** Fragment parsed as `a=1&b=2` (OAuth implicit flow, SPA routers). */
  hashParams: UrlParam[];
  /** Raw fragment when it is not a list of parameters. */
  hash: string;
}

export function classifyValue(value: string): { kind: ValueKind; preview?: string } {
  const v = value.trim();
  if (/^[[{]/.test(v)) {
    try {
      return { kind: "json", preview: JSON.stringify(JSON.parse(v), null, 2) };
    } catch {
      // not JSON
    }
  }
  if (detectJwt(v)) return { kind: "jwt" };
  if (/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(v)) return { kind: "url" };
  if (v.length >= 12 && (detectBase64(v)?.confidence ?? 0) >= 0.5) {
    try {
      return { kind: "base64", preview: base64UrlToText(v) };
    } catch {
      // not text
    }
  }
  return { kind: null };
}

function toParams(search: string, depth: number): UrlParam[] {
  const counts = new Map<string, number>();
  return [...new URLSearchParams(search)].map(([key, value]) => {
    const occurrence = counts.get(key) ?? 0;
    counts.set(key, occurrence + 1);
    const { kind, preview } = classifyValue(value);
    const nested = kind === "url" && depth < 3 ? parseUrl(value, depth + 1) : undefined;
    return { key, value, occurrence, kind, preview, ...(nested && "url" in nested ? { nested: nested.url } : {}) };
  });
}

/** Breaks a URL into its parts, decoding every parameter (also those in the `#` fragment). */
export function parseUrl(input: string, depth = 0): { url: ParsedUrl } | { error: "empty" | "invalid" } {
  const text = input.trim();
  if (!text) return { error: "empty" };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return { error: "invalid" };
  }
  const rawHash = url.hash.slice(1);
  const hashLooksLikeParams = /^[^/?]*=/.test(rawHash) || rawHash.startsWith("?");
  return {
    url: {
      href: url.href,
      protocol: url.protocol.replace(/:$/, ""),
      host: url.host,
      pathname: decodeURIComponent(url.pathname),
      params: toParams(url.search, depth),
      hashParams: hashLooksLikeParams ? toParams(rawHash.replace(/^\?/, ""), depth) : [],
      hash: hashLooksLikeParams ? "" : rawHash,
    },
  };
}

/** Rebuilds the URL with edited parameters, keeping their order. */
export function buildUrl(
  base: string,
  params: { key: string; value: string }[],
  hashParams?: { key: string; value: string }[],
): string {
  const url = new URL(base);
  url.search = new URLSearchParams(params.map((p) => [p.key, p.value])).toString();
  if (hashParams && hashParams.length > 0) {
    url.hash = new URLSearchParams(hashParams.map((p) => [p.key, p.value])).toString();
  }
  return url.toString();
}
