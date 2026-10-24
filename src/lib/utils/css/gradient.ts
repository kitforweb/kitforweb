import { splitTopLevel } from "./shadow";

export type GradientType = "linear" | "radial" | "conic";

export interface GradientStop {
  color: string;
  /** Position in % (0–100). */
  position: number;
}

export interface Gradient {
  type: GradientType;
  /** Degrees, for linear and conic. */
  angle: number;
  /** Radial shape. */
  shape: "circle" | "ellipse";
  /** Center for radial and conic, in % ("50% 50%"). */
  x: number;
  y: number;
  repeating: boolean;
  stops: GradientStop[];
}

export const DEFAULT_GRADIENT: Gradient = {
  type: "linear",
  angle: 90,
  shape: "circle",
  x: 50,
  y: 50,
  repeating: false,
  stops: [
    { color: "#6366f1", position: 0 },
    { color: "#ec4899", position: 100 },
  ],
};

const sorted = (stops: GradientStop[]) => [...stops].sort((a, b) => a.position - b.position);

export function gradientToCss(g: Gradient): string {
  const stops = sorted(g.stops)
    .map((s) => `${s.color} ${Math.round(s.position * 10) / 10}%`)
    .join(", ");
  const fn = `${g.repeating ? "repeating-" : ""}${g.type}-gradient`;
  const at = `at ${g.x}% ${g.y}%`;
  switch (g.type) {
    case "linear":
      return `${fn}(${g.angle}deg, ${stops})`;
    case "radial":
      return `${fn}(${g.shape} ${at}, ${stops})`;
    case "conic":
      return `${fn}(from ${g.angle}deg ${at}, ${stops})`;
  }
}

const SIDES: Record<string, number> = {
  "to top": 0,
  "to right": 90,
  "to bottom": 180,
  "to left": 270,
  "to top right": 45,
  "to right top": 45,
  "to bottom right": 135,
  "to right bottom": 135,
  "to bottom left": 225,
  "to left bottom": 225,
  "to top left": 315,
  "to left top": 315,
};

function angleOf(text: string): number | null {
  const m = /^(-?\d*\.?\d+)(deg|turn|rad|grad)$/.exec(text.trim());
  if (!m) return null;
  const n = Number(m[1]);
  const deg = m[2] === "turn" ? n * 360 : m[2] === "rad" ? (n * 180) / Math.PI : m[2] === "grad" ? n * 0.9 : n;
  return Math.round(((deg % 360) + 360) % 360);
}

function positionOf(text: string): [number, number] {
  const words: Record<string, number> = { left: 0, top: 0, center: 50, right: 100, bottom: 100 };
  const parts = text.trim().split(/\s+/);
  const v = (p: string | undefined) => (p === undefined ? 50 : p in words ? words[p] : parseFloat(p));
  let [x, y] = [v(parts[0]), v(parts[1])];
  if (parts[0] === "top" || parts[0] === "bottom") [x, y] = [v(parts[1]), v(parts[0])];
  return [Number.isFinite(x) ? x : 50, Number.isFinite(y) ? y : 50];
}

/** Parses a CSS gradient (with or without `background:`). Stops without position are spread evenly. */
export function parseGradient(text: string): Gradient | null {
  const value = text
    .trim()
    .replace(/^(background(-image)?)\s*:\s*/i, "")
    .replace(/;\s*$/, "");
  const m = /^(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)$/i.exec(value);
  if (!m) return null;
  const g: Gradient = { ...DEFAULT_GRADIENT, type: m[2].toLowerCase() as GradientType, repeating: !!m[1], stops: [] };
  const args = splitTopLevel(m[3]);
  const first = args[0]?.toLowerCase() ?? "";
  let rest = args;
  if (g.type === "linear") {
    const a = angleOf(first) ?? SIDES[first.replace(/\s+/g, " ")];
    if (a !== undefined) {
      g.angle = a;
      rest = args.slice(1);
    } else g.angle = 180;
  } else if (/^(from\s|at\s|circle|ellipse|closest|farthest)/.test(first)) {
    const from = /from\s+(\S+)/.exec(first);
    if (from) g.angle = angleOf(from[1]) ?? 0;
    else if (g.type === "conic") g.angle = 0;
    const at = /at\s+(.+)$/.exec(first);
    if (at) [g.x, g.y] = positionOf(at[1]);
    if (/ellipse/.test(first)) g.shape = "ellipse";
    else if (/circle/.test(first)) g.shape = "circle";
    rest = args.slice(1);
  } else {
    g.shape = "ellipse";
    if (g.type === "conic") g.angle = 0;
  }
  const raw = rest.map((s) => {
    const pm = /^(.*\S)\s+(-?\d*\.?\d+)%$/.exec(s);
    return pm ? { color: pm[1], position: Number(pm[2]) } : { color: s, position: Number.NaN };
  });
  if (raw.length < 2) return null;
  raw.forEach((s, i) => {
    if (Number.isNaN(s.position)) s.position = Math.round((i / (raw.length - 1)) * 1000) / 10;
  });
  g.stops = raw;
  return g;
}
