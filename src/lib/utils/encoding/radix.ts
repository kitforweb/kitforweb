export type Radix = 2 | 8 | 10 | 16;

const DIGITS: Record<Radix, RegExp> = {
  2: /^[01]+$/,
  8: /^[0-7]+$/,
  10: /^\d+$/,
  16: /^[0-9a-f]+$/i,
};

const PREFIX: Record<string, Radix> = { "0b": 2, "0o": 8, "0x": 16 };

export type ParsedNumber = { ok: true; value: bigint; radix: Radix } | { ok: false; error: "empty" | "digits" };

/**
 * Parses an integer of any size. With radix "auto", 0x / 0b / 0o prefixes are
 * honoured and plain digits are decimal. Underscores and spaces are ignored.
 */
export function parseInteger(input: string, radix: Radix | "auto" = "auto"): ParsedNumber {
  let text = input.trim().replace(/[_\s]/g, "").toLowerCase();
  if (!text) return { ok: false, error: "empty" };
  let negative = false;
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  let r: Radix = radix === "auto" ? 10 : radix;
  const prefix = PREFIX[text.slice(0, 2)];
  if (prefix && (radix === "auto" || radix === prefix)) {
    r = prefix;
    text = text.slice(2);
  }
  if (!text || !DIGITS[r].test(text)) return { ok: false, error: "digits" };
  const prefixes: Record<Radix, string> = { 2: "0b", 8: "0o", 10: "", 16: "0x" };
  const value = BigInt(prefixes[r] + text);
  return { ok: true, value: negative ? -value : value, radix: r };
}

/** Formats a BigInt in a base; binary is grouped in nibbles when `group` is set. */
export function formatInteger(value: bigint, radix: Radix, group = false): string {
  const negative = value < BigInt(0);
  let digits = (negative ? -value : value).toString(radix);
  if (radix === 16) digits = digits.toUpperCase();
  if (group && (radix === 2 || radix === 16)) {
    const size = radix === 2 ? 4 : 2;
    digits = digits
      .padStart(Math.ceil(digits.length / size) * size, "0")
      .replace(new RegExp(`(.{${size}})(?=.)`, "g"), "$1 ");
  }
  return (negative ? "-" : "") + digits;
}

export type ByteFormat = "hex" | "binary" | "decimal";

/** Text → UTF-8 bytes written in hex, binary or decimal, separated by spaces. */
export function textToBytes(text: string, format: ByteFormat): string {
  return [...new TextEncoder().encode(text)]
    .map((b) =>
      format === "hex"
        ? b.toString(16).padStart(2, "0")
        : format === "binary"
          ? b.toString(2).padStart(8, "0")
          : String(b),
    )
    .join(" ");
}

export type BytesToText = { ok: true; text: string } | { ok: false; error: "digits" | "utf8" };

/** Inverse of textToBytes. Hex also accepts a continuous string ("48656c6c6f") and 0x prefixes. */
export function bytesToText(input: string, format: ByteFormat): BytesToText {
  let tokens: string[];
  const clean = input.trim().replace(/0x/gi, "");
  if (format === "hex" && !/\s/.test(clean)) tokens = clean.match(/.{1,2}/g) ?? [];
  else tokens = clean.split(/[\s,]+/).filter(Boolean);
  const radix = format === "hex" ? 16 : format === "binary" ? 2 : 10;
  const valid = format === "hex" ? /^[0-9a-f]{1,2}$/i : format === "binary" ? /^[01]{1,8}$/ : /^\d{1,3}$/;
  const bytes: number[] = [];
  for (const t of tokens) {
    const n = parseInt(t, radix);
    if (!valid.test(t) || n > 255) return { ok: false, error: "digits" };
    bytes.push(n);
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)) };
  } catch {
    return { ok: false, error: "utf8" };
  }
}
