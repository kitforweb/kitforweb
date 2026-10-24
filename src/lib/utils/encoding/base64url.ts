/** Normalises Base64URL (or unpadded Base64) to padded standard Base64. */
export function toStandardBase64(input: string): string {
  const b64 = input.trim().replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad === 1) throw new Error("Invalid Base64 length");
  return pad === 0 ? b64 : b64 + "=".repeat(4 - pad);
}

/** Decodes Base64 or Base64URL (padded or not) into bytes. */
export function base64UrlToBytes(input: string): Uint8Array {
  const binary = atob(toStandardBase64(input));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Decodes Base64 or Base64URL into a UTF-8 string. Throws on invalid UTF-8. */
export function base64UrlToText(input: string): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(base64UrlToBytes(input));
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
