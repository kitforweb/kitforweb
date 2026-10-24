import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

/**
 * Share-by-link helpers. State lives only in the URL fragment (`#…`), which
 * browsers never send to the server.
 */
export function encodeShareState(state: unknown): string {
  return compressToEncodedURIComponent(JSON.stringify(state));
}

export function decodeShareState<T>(hash: string, guard: (v: unknown) => v is T): T | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  try {
    const text = decompressFromEncodedURIComponent(raw);
    if (!text) return null;
    const value: unknown = JSON.parse(text);
    return guard(value) ? value : null;
  } catch {
    return null;
  }
}
