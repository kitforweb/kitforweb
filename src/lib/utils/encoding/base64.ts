import { base64UrlToBytes } from "./base64url";

const encoder = new TextEncoder();

/** Bytes → Base64 (or unpadded Base64URL). Works with any size, without stack limits. */
export function bytesToBase64(bytes: Uint8Array, url = false): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  return url ? b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : b64;
}

export function encodeBase64(text: string, url = false): string {
  return bytesToBase64(encoder.encode(text), url);
}

/** Removes a `data:…;base64,` prefix and every whitespace character. */
export function cleanBase64(input: string): { data: string; mime?: string } {
  const trimmed = input.trim();
  const m = /^data:([^;,]+)?(?:;[^,]*)?;base64,/i.exec(trimmed);
  const data = (m ? trimmed.slice(m[0].length) : trimmed).replace(/\s+/g, "");
  return m?.[1] ? { data, mime: m[1] } : { data };
}

const SIGNATURES: [string, number[]][] = [
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/gif", [0x47, 0x49, 0x46, 0x38]],
  ["application/pdf", [0x25, 0x50, 0x44, 0x46]],
  ["application/zip", [0x50, 0x4b, 0x03, 0x04]],
  ["application/gzip", [0x1f, 0x8b]],
];

/** Guesses the type of binary content from its first bytes. */
export function sniffMime(bytes: Uint8Array): string | undefined {
  for (const [mime, sig] of SIGNATURES) if (sig.every((b, i) => bytes[i] === b)) return mime;
  if (bytes.length > 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF") {
    if (String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  }
  const head = new TextDecoder().decode(bytes.subarray(0, 256)).trimStart();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return undefined;
}

export type DecodedBase64 =
  { ok: true; bytes: Uint8Array; text: string | null; mime?: string } | { ok: false; error: "alphabet" | "length" };

/** Decodes standard Base64, Base64URL or a data URL. `text` is null for binary content. */
export function decodeBase64(input: string): DecodedBase64 {
  const { data, mime } = cleanBase64(input);
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(data)) return { ok: false, error: "alphabet" };
  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(data);
  } catch {
    return { ok: false, error: "length" };
  }
  const sniffed = mime ?? sniffMime(bytes);
  let text: string | null = null;
  if (!sniffed || sniffed === "image/svg+xml" || sniffed.startsWith("text/")) {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      // Mostly control characters: treat as binary.
      if (/[\x00-\x08\x0e-\x1f]/.test(text.slice(0, 512))) text = null;
    } catch {
      text = null;
    }
  }
  return { ok: true, bytes, text, mime: sniffed };
}
