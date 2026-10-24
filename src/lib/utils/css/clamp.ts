export interface ClampInput {
  /** Font size (px) at the minimum viewport. */
  minSize: number;
  /** Font size (px) at the maximum viewport. */
  maxSize: number;
  /** Viewport widths (px) where the value stops scaling. */
  minViewport: number;
  maxViewport: number;
  /** Root font size in px (usually 16). */
  rootFontSize: number;
}

export interface ClampResult {
  css: string;
  /** Lower and upper bounds in rem. */
  minRem: number;
  maxRem: number;
  /** Preferred value = interceptRem + slopeVw * 1vw. */
  interceptRem: number;
  slopeVw: number;
}

export type ClampError = "viewport" | "root" | "nan";

const round = (n: number, decimals = 4) => {
  const f = 10 ** decimals;
  const r = Math.round(n * f) / f;
  return Object.is(r, -0) ? 0 : r;
};

/**
 * Builds a fluid `clamp()` mixing rem + vw, so the value still respects the
 * user's zoom / default font size. Works for growing and shrinking values.
 */
export function buildClamp(input: ClampInput): { ok: true; result: ClampResult } | { ok: false; error: ClampError } {
  const { minSize, maxSize, minViewport, maxViewport, rootFontSize } = input;
  if (![minSize, maxSize, minViewport, maxViewport, rootFontSize].every(Number.isFinite)) {
    return { ok: false, error: "nan" };
  }
  if (rootFontSize <= 0) return { ok: false, error: "root" };
  if (maxViewport <= minViewport || minViewport < 0) return { ok: false, error: "viewport" };

  const slope = (maxSize - minSize) / (maxViewport - minViewport);
  const interceptPx = minSize - slope * minViewport;

  const minRem = round(Math.min(minSize, maxSize) / rootFontSize);
  const maxRem = round(Math.max(minSize, maxSize) / rootFontSize);
  const interceptRem = round(interceptPx / rootFontSize);
  const slopeVw = round(slope * 100);

  let preferred: string;
  if (slopeVw === 0) preferred = `${interceptRem}rem`;
  else if (interceptRem === 0) preferred = `${slopeVw}vw`;
  else preferred = `${interceptRem}rem ${slopeVw < 0 ? "-" : "+"} ${Math.abs(slopeVw)}vw`;

  return {
    ok: true,
    result: { css: `clamp(${minRem}rem, ${preferred}, ${maxRem}rem)`, minRem, maxRem, interceptRem, slopeVw },
  };
}

/** Resolved size in px of a clamp result at a given viewport width. */
export function evaluateClamp(result: ClampResult, viewport: number, rootFontSize: number): number {
  const preferred = result.interceptRem * rootFontSize + (result.slopeVw * viewport) / 100;
  return Math.min(Math.max(preferred, result.minRem * rootFontSize), result.maxRem * rootFontSize);
}
