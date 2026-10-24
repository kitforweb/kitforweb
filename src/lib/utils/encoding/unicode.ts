/** Names of invisible or confusing characters that are worth pointing out. */
export const SPECIAL_CHARS: Record<number, string> = {
  0x0009: "CHARACTER TABULATION",
  0x000a: "LINE FEED",
  0x000d: "CARRIAGE RETURN",
  0x0020: "SPACE",
  0x00a0: "NO-BREAK SPACE",
  0x00ad: "SOFT HYPHEN",
  0x034f: "COMBINING GRAPHEME JOINER",
  0x061c: "ARABIC LETTER MARK",
  0x115f: "HANGUL CHOSEONG FILLER",
  0x180e: "MONGOLIAN VOWEL SEPARATOR",
  0x2000: "EN QUAD",
  0x2002: "EN SPACE",
  0x2003: "EM SPACE",
  0x2007: "FIGURE SPACE",
  0x2009: "THIN SPACE",
  0x200a: "HAIR SPACE",
  0x200b: "ZERO WIDTH SPACE",
  0x200c: "ZERO WIDTH NON-JOINER",
  0x200d: "ZERO WIDTH JOINER",
  0x200e: "LEFT-TO-RIGHT MARK",
  0x200f: "RIGHT-TO-LEFT MARK",
  0x2028: "LINE SEPARATOR",
  0x2029: "PARAGRAPH SEPARATOR",
  0x202a: "LEFT-TO-RIGHT EMBEDDING",
  0x202b: "RIGHT-TO-LEFT EMBEDDING",
  0x202c: "POP DIRECTIONAL FORMATTING",
  0x202d: "LEFT-TO-RIGHT OVERRIDE",
  0x202e: "RIGHT-TO-LEFT OVERRIDE",
  0x202f: "NARROW NO-BREAK SPACE",
  0x205f: "MEDIUM MATHEMATICAL SPACE",
  0x2060: "WORD JOINER",
  0x2066: "LEFT-TO-RIGHT ISOLATE",
  0x2067: "RIGHT-TO-LEFT ISOLATE",
  0x2068: "FIRST STRONG ISOLATE",
  0x2069: "POP DIRECTIONAL ISOLATE",
  0x3000: "IDEOGRAPHIC SPACE",
  0xfe0f: "VARIATION SELECTOR-16",
  0xfeff: "ZERO WIDTH NO-BREAK SPACE (BOM)",
  0xfffd: "REPLACEMENT CHARACTER",
};

export type CharCategory =
  "letter" | "mark" | "number" | "punctuation" | "symbol" | "space" | "control" | "format" | "other";

export interface CharInfo {
  char: string;
  codePoint: number;
  /** U+00E9 */
  label: string;
  category: CharCategory;
  /** True for characters you cannot see (zero-width, bidi controls, BOM…). */
  invisible: boolean;
  name?: string;
  utf8: string;
  utf16: string;
  js: string;
  html: string;
  css: string;
}

const hex = (n: number, pad: number) => n.toString(16).toUpperCase().padStart(pad, "0");

export function category(char: string): CharCategory {
  if (/\p{L}/u.test(char)) return "letter";
  if (/\p{M}/u.test(char)) return "mark";
  if (/\p{N}/u.test(char)) return "number";
  if (/\p{P}/u.test(char)) return "punctuation";
  if (/\p{S}/u.test(char)) return "symbol";
  if (/\p{Z}/u.test(char)) return "space";
  if (/\p{Cc}/u.test(char)) return "control";
  if (/\p{Cf}/u.test(char)) return "format";
  return "other";
}

export function describeChar(char: string): CharInfo {
  const codePoint = char.codePointAt(0) ?? 0;
  const cat = category(char);
  const utf8 = [...new TextEncoder().encode(char)].map((b) => hex(b, 2)).join(" ");
  const units = Array.from({ length: char.length }, (_, i) => char.charCodeAt(i));
  const invisible =
    cat === "format" ||
    (cat === "control" && ![0x09, 0x0a, 0x0d].includes(codePoint)) ||
    [0x00ad, 0x034f, 0x115f, 0x180e, 0x3164].includes(codePoint) ||
    (cat === "space" && codePoint !== 0x20);
  return {
    char,
    codePoint,
    label: `U+${hex(codePoint, 4)}`,
    category: cat,
    invisible,
    name: SPECIAL_CHARS[codePoint],
    utf8,
    utf16: units.map((u) => hex(u, 4)).join(" "),
    js: codePoint > 0xffff ? `\\u{${hex(codePoint, 1)}}` : `\\u${hex(codePoint, 4)}`,
    html: `&#x${hex(codePoint, 1)};`,
    css: `\\${hex(codePoint, 1)}`,
  };
}

/** One entry per code point (an emoji with a skin tone is several code points). */
export function analyzeText(text: string, limit = 5000): CharInfo[] {
  return Array.from(text).slice(0, limit).map(describeChar);
}

/** Removes invisible characters (zero-width, bidi controls, BOM, soft hyphen). */
export function stripInvisible(text: string): string {
  return Array.from(text)
    .filter((c) => {
      const info = describeChar(c);
      return !info.invisible || /\s/.test(c);
    })
    .join("");
}

/** Escapes the whole text for a JavaScript string literal (non-ASCII only). */
export function escapeForJs(text: string): string {
  return Array.from(text)
    .map((c) => {
      const cp = c.codePointAt(0) ?? 0;
      return cp >= 0x20 && cp < 0x7f ? c : describeChar(c).js;
    })
    .join("");
}

/** Reverses \uXXXX, \u{X} and \xXX escapes. */
export function unescapeJs(text: string): string {
  return text
    .replace(/\\u\{([0-9a-f]{1,6})\}/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-f]{4})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}
