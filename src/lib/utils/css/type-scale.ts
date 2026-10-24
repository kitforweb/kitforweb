import { buildClamp } from "./clamp";

export interface TypeScaleInput {
  /** Base font size (px) at the minimum and maximum viewport. */
  minBase: number;
  maxBase: number;
  /** Ratio between steps at each end (1.2 minor third, 1.25 major third…). */
  minRatio: number;
  maxRatio: number;
  minViewport: number;
  maxViewport: number;
  rootFontSize: number;
  /** Steps below and above the base. */
  stepsDown: number;
  stepsUp: number;
}

export interface TypeStep {
  /** -2 … 0 (base) … n */
  index: number;
  /** Tailwind-like name: xs, sm, base, lg, xl, 2xl… */
  name: string;
  minPx: number;
  maxPx: number;
  clamp: string;
}

export type TypeScaleResult =
  { ok: true; steps: TypeStep[] } | { ok: false; error: "ratio" | "viewport" | "base" | "steps" };

export const RATIOS = [
  { value: 1.067, name: "Minor second" },
  { value: 1.125, name: "Major second" },
  { value: 1.2, name: "Minor third" },
  { value: 1.25, name: "Major third" },
  { value: 1.333, name: "Perfect fourth" },
  { value: 1.414, name: "Augmented fourth" },
  { value: 1.5, name: "Perfect fifth" },
  { value: 1.618, name: "Golden ratio" },
] as const;

const DOWN = ["sm", "xs", "2xs", "3xs"];
const UP = ["lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"];

export function stepName(index: number): string {
  if (index === 0) return "base";
  return index < 0 ? (DOWN[-index - 1] ?? `${-index}xs-down`) : (UP[index - 1] ?? `${index}up`);
}

const round = (n: number) => Math.round(n * 100) / 100;

export function typeScale(input: TypeScaleInput): TypeScaleResult {
  const { minBase, maxBase, minRatio, maxRatio, stepsDown, stepsUp } = input;
  if (!(minRatio > 1 && maxRatio > 1) || minRatio > 4 || maxRatio > 4) return { ok: false, error: "ratio" };
  if (!(minBase > 0 && maxBase > 0)) return { ok: false, error: "base" };
  if (
    !Number.isInteger(stepsDown) ||
    !Number.isInteger(stepsUp) ||
    stepsDown < 0 ||
    stepsUp < 0 ||
    stepsDown > 4 ||
    stepsUp > 10
  )
    return { ok: false, error: "steps" };
  const steps: TypeStep[] = [];
  for (let i = stepsUp; i >= -stepsDown; i--) {
    const minPx = minBase * minRatio ** i;
    const maxPx = maxBase * maxRatio ** i;
    const r = buildClamp({ ...input, minSize: minPx, maxSize: maxPx });
    if (!r.ok) return { ok: false, error: r.error === "viewport" ? "viewport" : "base" };
    steps.push({ index: i, name: stepName(i), minPx: round(minPx), maxPx: round(maxPx), clamp: r.result.css });
  }
  return { ok: true, steps };
}

export type TypeScaleFormat = "css" | "tailwind4" | "tailwind3";

export function exportTypeScale(steps: TypeStep[], format: TypeScaleFormat): string {
  switch (format) {
    case "css":
      return `:root {\n${steps.map((s) => `  --step-${s.index}: ${s.clamp};`).join("\n")}\n}\n`;
    case "tailwind4":
      return `@theme {\n${steps.map((s) => `  --text-${s.name}: ${s.clamp};`).join("\n")}\n}\n`;
    case "tailwind3":
      return `// tailwind.config.js → theme.extend.fontSize\n{\n${steps
        .map((s) => `  ${/^\d/.test(s.name) ? JSON.stringify(s.name) : s.name}: "${s.clamp}",`)
        .join("\n")}\n}\n`;
  }
}
