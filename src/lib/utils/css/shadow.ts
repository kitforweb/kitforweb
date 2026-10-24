/** One layer of a box-shadow. Lengths are in px. */
export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** Any CSS color. */
  color: string;
  inset: boolean;
}

export const DEFAULT_LAYER: ShadowLayer = { x: 0, y: 4, blur: 12, spread: 0, color: "rgb(0 0 0 / 0.15)", inset: false };

const px = (n: number) => (n === 0 ? "0" : `${n}px`);

export function layerToCss(l: ShadowLayer): string {
  const parts = [px(l.x), px(l.y), px(l.blur)];
  if (l.spread !== 0) parts.push(px(l.spread));
  parts.push(l.color);
  return (l.inset ? "inset " : "") + parts.join(" ");
}

export function shadowToCss(layers: ShadowLayer[]): string {
  return layers.length === 0 ? "none" : layers.map(layerToCss).join(",\n    ");
}

/** Splits on commas that are not inside parentheses. */
export function splitTopLevel(text: string, separator = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === separator && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

const LENGTH = /^(-?\d*\.?\d+)(px)?$/;

/** Parses "box-shadow: 0 1px 2px rgba(0,0,0,.2), inset 0 0 0 1px #fff" (with or without the property). */
export function parseBoxShadow(text: string): ShadowLayer[] | null {
  const value = text
    .trim()
    .replace(/^box-shadow\s*:\s*/i, "")
    .replace(/;\s*$/, "")
    .trim();
  if (!value || value === "none") return value === "none" ? [] : null;
  const layers: ShadowLayer[] = [];
  for (const raw of splitTopLevel(value)) {
    const tokens = splitTopLevel(raw.replace(/\s+/g, " "), " ");
    let inset = false;
    const lengths: number[] = [];
    const color: string[] = [];
    for (const tok of tokens) {
      if (tok.toLowerCase() === "inset") inset = true;
      else if (LENGTH.test(tok) && color.length === 0) {
        const m = LENGTH.exec(tok)!;
        if (m[2] === undefined && Number(m[1]) !== 0) return null;
        lengths.push(Number(m[1]));
      } else color.push(tok);
    }
    if (lengths.length < 2 || lengths.length > 4) return null;
    const [x, y, blur = 0, spread = 0] = lengths;
    if (blur < 0) return null;
    layers.push({ x, y, blur, spread, color: color.join(" ") || "currentColor", inset });
  }
  return layers;
}

/** Tailwind's shadow presets, a good starting point. */
export const SHADOW_PRESETS: Record<string, string> = {
  sm: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
};
