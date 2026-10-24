export type CssUnit = "px" | "rem" | "em";

const trim = (n: number, precision: number) => {
  const r = Number(n.toFixed(precision));
  return Object.is(r, -0) ? 0 : r;
};

/** Converts a value between px, rem and em. `base` is the root (rem) or parent (em) font size in px. */
export function convertUnit(value: number, from: CssUnit, to: CssUnit, base = 16, precision = 4): number {
  const px = from === "px" ? value : value * base;
  return trim(to === "px" ? px : px / base, precision);
}

// Not preceded by a word character, # or . (so "h1px", "#12em" or "1.5.3px" are left alone).
const VALUE = /(?<![\w#.])(-?\d*\.?\d+)(px|rem|em)\b/g;

export interface BatchResult {
  output: string;
  /** How many values were converted. */
  count: number;
}

/**
 * Converts every `from` length in a CSS snippet (or a list of values) to `to`.
 * 1px hairlines can be kept as px, since rem borders can vanish when zoomed out.
 */
export function convertCss(
  css: string,
  from: CssUnit,
  to: CssUnit,
  options: { base?: number; precision?: number; keepHairlines?: boolean } = {},
): BatchResult {
  const { base = 16, precision = 4, keepHairlines = true } = options;
  let count = 0;
  const output = css.replace(VALUE, (match, num: string, unit: string, offset: number) => {
    if (unit !== from) return match;
    // Skip values inside url(…).
    if (/url\([^)]*$/.test(css.slice(Math.max(0, offset - 200), offset))) return match;
    const n = Number(num);
    if (keepHairlines && from === "px" && Math.abs(n) === 1) return match;
    count++;
    const v = convertUnit(n, from as CssUnit, to, base, precision);
    return v === 0 ? "0" : `${v}${to}`;
  });
  return { output, count };
}

/** Rows of the reference table: common px sizes and their rem value. */
export function referenceTable(base = 16): { px: number; rem: number }[] {
  return [2, 4, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96].map((px) => ({
    px,
    rem: convertUnit(px, "px", "rem", base),
  }));
}
