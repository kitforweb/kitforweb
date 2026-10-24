/** Control points of a cubic-bezier() timing function: P1 = (x1, y1), P2 = (x2, y2). */
export type Bezier = [x1: number, y1: number, x2: number, y2: number];

export const KEYWORDS: Record<string, Bezier> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

/** Popular easings (easings.net) and Material's standard curves. */
export const PRESETS: Record<string, Bezier> = {
  ...KEYWORDS,
  easeInSine: [0.12, 0, 0.39, 0],
  easeOutSine: [0.61, 1, 0.88, 1],
  easeInOutSine: [0.37, 0, 0.63, 1],
  easeInCubic: [0.32, 0, 0.67, 0],
  easeOutCubic: [0.33, 1, 0.68, 1],
  easeInOutCubic: [0.65, 0, 0.35, 1],
  easeInQuint: [0.64, 0, 0.78, 0],
  easeOutQuint: [0.22, 1, 0.36, 1],
  easeInOutQuint: [0.83, 0, 0.17, 1],
  easeInExpo: [0.7, 0, 0.84, 0],
  easeOutExpo: [0.16, 1, 0.3, 1],
  easeInOutExpo: [0.87, 0, 0.13, 1],
  easeInBack: [0.36, 0, 0.66, -0.56],
  easeOutBack: [0.34, 1.56, 0.64, 1],
  easeInOutBack: [0.68, -0.6, 0.32, 1.6],
  "material-standard": [0.2, 0, 0, 1],
  "material-emphasized-decelerate": [0.05, 0.7, 0.1, 1],
};

const round = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

export const isValid = (b: Bezier) => b.every(Number.isFinite) && b[0] >= 0 && b[0] <= 1 && b[2] >= 0 && b[2] <= 1;

export function bezierToCss(b: Bezier): string {
  const r = b.map(round) as Bezier;
  const keyword = Object.entries(KEYWORDS).find(([, k]) => k.every((v, i) => v === r[i]));
  return keyword ? keyword[0] : `cubic-bezier(${r.join(", ")})`;
}

export type BezierParse = { ok: true; bezier: Bezier } | { ok: false; error: "syntax" | "x-range" };

/** Reads "cubic-bezier(.17,.67,.83,.67)", a keyword, or four numbers. */
export function parseBezier(text: string): BezierParse {
  const t = text
    .trim()
    .replace(/^(transition-timing-function|animation-timing-function)\s*:\s*/i, "")
    .replace(/;$/, "")
    .trim()
    .toLowerCase();
  if (t in KEYWORDS) return { ok: true, bezier: [...KEYWORDS[t]] as Bezier };
  const m = /^(?:cubic-bezier\()?\s*([^()]*?)\s*\)?$/.exec(t);
  const nums =
    m?.[1]
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number) ?? [];
  if (nums.length !== 4 || !nums.every(Number.isFinite) || (t.includes("(") && !t.startsWith("cubic-bezier(")))
    return { ok: false, error: "syntax" };
  const b = nums as Bezier;
  return isValid(b) ? { ok: true, bezier: b } : { ok: false, error: "x-range" };
}

const coord = (t: number, p1: number, p2: number) => 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3;

/** Progress (y) at a given time (x), solving x(t) = x by bisection. */
export function evaluate(b: Bezier, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (coord(mid, b[0], b[2]) < x) lo = mid;
    else hi = mid;
  }
  return coord((lo + hi) / 2, b[1], b[3]);
}

/** SVG path of the curve in a unit box with y up (0,0 bottom-left → 1,1 top-right). */
export function curvePath(b: Bezier, size: number, pad = 0): string {
  const X = (v: number) => round(pad + v * size);
  const Y = (v: number) => round(pad + (1 - v) * size);
  return `M ${X(0)} ${Y(0)} C ${X(b[0])} ${Y(b[1])}, ${X(b[2])} ${Y(b[3])}, ${X(1)} ${Y(1)}`;
}
