import { bytesToBase64, cleanBase64 } from "./base64";
import { base64UrlToBytes } from "./base64url";

export type CompressionFormat = "gzip" | "deflate" | "deflate-raw";

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function compressBytes(bytes: Uint8Array, format: CompressionFormat): Promise<Uint8Array> {
  return pipe(bytes, new CompressionStream(format));
}

export async function decompressBytes(bytes: Uint8Array, format: CompressionFormat): Promise<Uint8Array> {
  return pipe(bytes, new DecompressionStream(format));
}

/** gzip starts with 1F 8B; zlib (deflate) with 78 01 / 5E / 9C / DA; anything else is tried as raw deflate. */
export function detectFormat(bytes: Uint8Array): CompressionFormat {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return "gzip";
  if (bytes[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(bytes[1])) return "deflate";
  return "deflate-raw";
}

export interface CompressResult {
  base64: string;
  inputBytes: number;
  outputBytes: number;
}

export async function compressText(text: string, format: CompressionFormat): Promise<CompressResult> {
  const input = new TextEncoder().encode(text);
  const output = await compressBytes(input, format);
  return { base64: bytesToBase64(output), inputBytes: input.length, outputBytes: output.length };
}

export type DecompressResult =
  | { ok: true; text: string; format: CompressionFormat; inputBytes: number; outputBytes: number }
  | { ok: false; error: "base64" | "data" | "utf8" };

/** Decompresses Base64 (or a data URL) in gzip, zlib or raw deflate format. */
export async function decompressBase64(
  input: string,
  format: CompressionFormat | "auto" = "auto",
): Promise<DecompressResult> {
  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(cleanBase64(input).data);
  } catch {
    return { ok: false, error: "base64" };
  }
  const used = format === "auto" ? detectFormat(bytes) : format;
  let out: Uint8Array;
  try {
    out = await decompressBytes(bytes, used);
  } catch {
    return { ok: false, error: "data" };
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(out);
    return { ok: true, text, format: used, inputBytes: bytes.length, outputBytes: out.length };
  } catch {
    return { ok: false, error: "utf8" };
  }
}
