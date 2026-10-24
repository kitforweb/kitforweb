import {
  clampChroma,
  colorsNamed,
  converter,
  differenceEuclidean,
  displayable,
  formatHex,
  formatHex8,
  nearest,
  parse,
  wcagContrast,
  type Color,
  type Oklch,
} from "culori";

const toOklch = converter("oklch");
const toRgb = converter("rgb");
const toHsl = converter("hsl");

const round = (n: number | undefined, d = 2) => {
  const f = 10 ** d;
  const r = Math.round((n ?? 0) * f) / f;
  return Object.is(r, -0) ? 0 : r;
};

export interface ColorFormats {
  hex: string;
  rgb: string;
  hsl: string;
  oklch: string;
  /** Exact CSS named color, if there is one. */
  name: string | null;
  /** Closest CSS named color (always set). */
  nearestName: string;
  alpha: number;
  /** False when the color is outside sRGB and was clamped to show it. */
  inGamut: boolean;
}

export type ColorResult = { ok: true; color: Color; formats: ColorFormats } | { ok: false; error: "invalid" };

const NAMES = Object.keys(colorsNamed);
const nearestNamed = nearest(NAMES, differenceEuclidean("oklab"));
const HEX_TO_NAME = new Map(
  Object.entries(colorsNamed).map(([name, value]) => [`#${value.toString(16).padStart(6, "0")}`, name]),
);

export function parseColor(text: string): Color | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  // Bare hex without # ("3b82f6") is common when copying from design tools.
  const c = parse(/^[0-9a-f]{3,8}$/.test(t) && [3, 4, 6, 8].includes(t.length) ? `#${t}` : t);
  return c ?? null;
}

export function formatColor(color: Color): ColorFormats {
  const inGamut = displayable(color);
  const srgb = inGamut ? toRgb(color) : toRgb(clampChroma(color, "oklch"));
  const alpha = round(color.alpha ?? 1, 3);
  const hasAlpha = alpha < 1;
  const hex = hasAlpha ? formatHex8(srgb) : formatHex(srgb);
  const r = Math.round(srgb.r * 255);
  const g = Math.round(srgb.g * 255);
  const b = Math.round(srgb.b * 255);
  const hsl = toHsl(srgb);
  const ok = toOklch(color);
  const a = hasAlpha ? ` / ${alpha}` : "";
  return {
    hex,
    rgb: `rgb(${r} ${g} ${b}${a})`,
    hsl: `hsl(${round(hsl.h ?? 0, 1)} ${round(hsl.s * 100, 1)}% ${round(hsl.l * 100, 1)}%${a})`,
    oklch: `oklch(${round(ok.l * 100, 2)}% ${round(ok.c, 4)} ${round(ok.h ?? 0, 2)}${a})`,
    name: hasAlpha ? null : (HEX_TO_NAME.get(formatHex(srgb)) ?? null),
    nearestName: nearestNamed(srgb, 1)[0],
    alpha,
    inGamut,
  };
}

export function convertColor(text: string): ColorResult {
  const color = parseColor(text);
  if (!color) return { ok: false, error: "invalid" };
  return { ok: true, color, formats: formatColor(color) };
}

// ---------------------------------------------------------------------------
// Contrast

export type WcagLevel = "AA" | "AAA";

export interface ContrastReport {
  ratio: number;
  /** Normal text (< 24px, or < 18.66px bold): AA 4.5, AAA 7. Large text: AA 3, AAA 4.5. UI: 3. */
  normal: { AA: boolean; AAA: boolean };
  large: { AA: boolean; AAA: boolean };
  ui: boolean;
}

const opaqueOver = (fg: Color, bg: Color): Color => {
  const a = fg.alpha ?? 1;
  if (a >= 1) return fg;
  const f = toRgb(fg);
  const b = toRgb(bg);
  return { mode: "rgb", r: f.r * a + b.r * (1 - a), g: f.g * a + b.g * (1 - a), b: f.b * a + b.b * (1 - a) };
};

export function contrastReport(fg: Color, bg: Color): ContrastReport {
  const ratio = Math.floor(wcagContrast(opaqueOver(fg, bg), { ...bg, alpha: 1 }) * 100) / 100;
  return {
    ratio,
    normal: { AA: ratio >= 4.5, AAA: ratio >= 7 },
    large: { AA: ratio >= 3, AAA: ratio >= 4.5 },
    ui: ratio >= 3,
  };
}

/**
 * The closest color to `fg` (same hue and chroma, only lightness changes in
 * OKLCH) that reaches `target` against `bg`. Null when no lightness reaches it.
 */
export function suggestForeground(fg: Color, bg: Color, target: number): string | null {
  const base = toOklch(fg);
  const ratioAt = (l: number) => wcagContrast(clampChroma({ ...base, l, alpha: 1 }, "oklch"), { ...bg, alpha: 1 });
  if (ratioAt(base.l) >= target) return formatHex(clampChroma({ ...base, alpha: 1 }, "oklch"));
  let best: number | null = null;
  // Search darker and lighter: keep whichever reaches the target with the smaller change.
  for (const end of [0, 1]) {
    if (ratioAt(end) < target) continue;
    let lo = base.l;
    let hi = end;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (ratioAt(mid) >= target) hi = mid;
      else lo = mid;
    }
    // Rounding to 8-bit hex can lose a little contrast: keep moving until the hex itself passes.
    const hexAt = (l: number) => formatHex(clampChroma({ ...base, l, alpha: 1 }, "oklch"));
    const passes = (l: number) => Math.floor(wcagContrast(hexAt(l), { ...bg, alpha: 1 }) * 100) / 100 >= target;
    for (let i = 0; i < 100 && !passes(hi); i++) hi += end === 0 ? -0.002 : 0.002;
    if (!passes(hi)) continue;
    if (best === null || Math.abs(hi - base.l) < Math.abs(best - base.l)) best = hi;
  }
  return best === null ? null : formatHex(clampChroma({ ...base, l: best, alpha: 1 }, "oklch"));
}

// ---------------------------------------------------------------------------
// Tailwind-like scale

export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type ScaleStep = (typeof SCALE_STEPS)[number];

// Lightness of Tailwind v4's palettes (average of its hues), in OKLCH.
const LIGHTNESS: Record<ScaleStep, number> = {
  50: 0.975,
  100: 0.94,
  200: 0.885,
  300: 0.81,
  400: 0.71,
  500: 0.63,
  600: 0.555,
  700: 0.49,
  800: 0.43,
  900: 0.375,
  950: 0.27,
};
// Chroma relative to the 500 step: pale and very dark steps are less saturated.
const CHROMA: Record<ScaleStep, number> = {
  50: 0.12,
  100: 0.25,
  200: 0.45,
  300: 0.7,
  400: 0.9,
  500: 1,
  600: 0.95,
  700: 0.85,
  800: 0.72,
  900: 0.6,
  950: 0.45,
};

export interface ScaleColor {
  step: ScaleStep;
  hex: string;
  oklch: string;
  /** True for the step that keeps the input color unchanged. */
  base: boolean;
}

/** A 50–950 scale around `color`: the input lands, unchanged, on its closest step. */
export function colorScale(color: Color): ScaleColor[] {
  const c = toOklch(color);
  const baseStep = SCALE_STEPS.reduce((a, b) => (Math.abs(LIGHTNESS[b] - c.l) < Math.abs(LIGHTNESS[a] - c.l) ? b : a));
  const peak = c.c / CHROMA[baseStep];
  const shift = c.l - LIGHTNESS[baseStep];
  return SCALE_STEPS.map((step) => {
    // Spread the lightness offset of the input so neighbouring steps stay ordered.
    const distance = Math.abs(SCALE_STEPS.indexOf(step) - SCALE_STEPS.indexOf(baseStep));
    const l = Math.min(0.99, Math.max(0.05, LIGHTNESS[step] + shift / (1 + distance)));
    const ok: Oklch =
      step === baseStep ? { ...c, alpha: undefined } : { mode: "oklch", l, c: peak * CHROMA[step], h: c.h };
    const shown = clampChroma(ok, "oklch") as Oklch;
    return {
      step,
      hex: formatHex(shown),
      oklch: `oklch(${round(shown.l * 100, 1)}% ${round(shown.c, 3)} ${round(shown.h ?? 0, 1)})`,
      base: step === baseStep,
    };
  });
}

export type ScaleFormat = "css" | "tailwind4" | "tailwind3" | "scss";

export function exportScale(
  name: string,
  scale: ScaleColor[],
  format: ScaleFormat,
  space: "hex" | "oklch" = "oklch",
): string {
  const id =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "brand";
  const v = (s: ScaleColor) => (space === "hex" ? s.hex : s.oklch);
  switch (format) {
    case "css":
      return `:root {\n${scale.map((s) => `  --${id}-${s.step}: ${v(s)};`).join("\n")}\n}\n`;
    case "tailwind4":
      return `@theme {\n${scale.map((s) => `  --color-${id}-${s.step}: ${v(s)};`).join("\n")}\n}\n`;
    case "scss":
      return scale.map((s) => `$${id}-${s.step}: ${v(s)};`).join("\n") + "\n";
    case "tailwind3":
      return `// tailwind.config.js → theme.extend.colors\n${JSON.stringify(id)}: {\n${scale
        .map((s) => `  ${s.step}: "${s.hex}",`)
        .join("\n")}\n},\n`;
  }
}
