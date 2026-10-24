import punycode from "punycode/";

export type PunycodeResult = { ok: true; output: string } | { ok: false; error: string };

function convertHost(host: string, toAscii: boolean): string {
  return toAscii ? punycode.toASCII(host.toLowerCase()) : punycode.toUnicode(host);
}

/**
 * Converts the domain part of a domain, an email address or a full URL. Only
 * the host is touched: paths and query strings are kept as they are.
 */
export function convertDomain(input: string, toAscii: boolean): PunycodeResult {
  const text = input.trim();
  if (!text) return { ok: false, error: "empty" };
  try {
    const urlMatch = /^([a-z][a-z0-9+.-]*:\/\/)([^/?#:]+)(.*)$/i.exec(text);
    if (urlMatch) return { ok: true, output: urlMatch[1] + convertHost(urlMatch[2], toAscii) + urlMatch[3] };
    const at = text.lastIndexOf("@");
    if (at > 0) return { ok: true, output: text.slice(0, at + 1) + convertHost(text.slice(at + 1), toAscii) };
    if (/\s/.test(text)) return { ok: false, error: "spaces" };
    const output = convertHost(text, toAscii);
    if (toAscii && output.split(".").some((label) => label.length > 63)) return { ok: false, error: "label" };
    return { ok: true, output };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Converts every non-empty line; errors are reported per line. */
export function convertLines(input: string, toAscii: boolean): { output: string; errors: number[] } {
  const errors: number[] = [];
  const output = input
    .split(/\r?\n/)
    .map((line, i) => {
      if (!line.trim()) return line;
      const r = convertDomain(line, toAscii);
      if (!r.ok) errors.push(i + 1);
      return r.ok ? r.output : line;
    })
    .join("\n");
  return { output, errors };
}
