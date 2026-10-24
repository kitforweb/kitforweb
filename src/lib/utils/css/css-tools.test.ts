import { describe, expect, it } from "vitest";
import { bezierToCss, curvePath, evaluate, parseBezier, PRESETS } from "./bezier";
import { colorScale, contrastReport, convertColor, exportScale, parseColor, suggestForeground } from "./color";
import { DEFAULT_GRADIENT, gradientToCss, parseGradient } from "./gradient";
import { layerToCss, parseBoxShadow, shadowToCss, splitTopLevel } from "./shadow";
import { exportTypeScale, stepName, typeScale, type TypeScaleInput } from "./type-scale";
import { convertCss, convertUnit, referenceTable } from "./units";

describe("color converter", () => {
  it("converts a hex color to every format", () => {
    const r = convertColor("#3b82f6");
    expect(r.ok && r.formats).toMatchObject({
      hex: "#3b82f6",
      rgb: "rgb(59 130 246)",
      hsl: "hsl(217.2 91.2% 59.8%)",
      oklch: "oklch(62.31% 0.188 259.81)",
      name: null,
      alpha: 1,
      inGamut: true,
    });
  });

  it("knows CSS names, bare hex and alpha", () => {
    const red = convertColor("rebeccapurple");
    expect(red.ok && [red.formats.hex, red.formats.name]).toEqual(["#663399", "rebeccapurple"]);
    const bare = convertColor("ff0000");
    expect(bare.ok && bare.formats.name).toBe("red");
    const alpha = convertColor("rgb(0 0 0 / 50%)");
    expect(alpha.ok && [alpha.formats.hex, alpha.formats.rgb]).toEqual(["#00000080", "rgb(0 0 0 / 0.5)"]);
    const near = convertColor("#ff0001");
    expect(near.ok && near.formats.nearestName).toBe("red");
  });

  it("flags colors outside sRGB", () => {
    const wide = convertColor("oklch(70% 0.4 150)");
    expect(wide.ok && wide.formats.inGamut).toBe(false);
    expect(wide.ok && /^#[0-9a-f]{6}$/.test(wide.formats.hex)).toBe(true);
  });

  it("rejects invalid colors", () => {
    for (const bad of ["", "blurple", "#12", "rgb(1,2)"]) expect(convertColor(bad).ok).toBe(false);
  });
});

describe("contrast", () => {
  const c = (s: string) => parseColor(s)!;

  it("computes the WCAG ratio and levels", () => {
    expect(contrastReport(c("#000"), c("#fff"))).toEqual({
      ratio: 21,
      normal: { AA: true, AAA: true },
      large: { AA: true, AAA: true },
      ui: true,
    });
    const grey = contrastReport(c("#777"), c("#fff"));
    expect(grey.ratio).toBe(4.47);
    expect(grey.normal.AA).toBe(false);
    expect(grey.large.AA).toBe(true);
  });

  it("blends a transparent foreground over the background", () => {
    expect(contrastReport(c("rgb(0 0 0 / 0)"), c("#fff")).ratio).toBe(1);
  });

  it("suggests the closest passing foreground", () => {
    const s = suggestForeground(c("#777"), c("#fff"), 4.5)!;
    const r = contrastReport(c(s), c("#fff")).ratio;
    expect(r).toBeGreaterThanOrEqual(4.5);
    expect(r).toBeLessThan(4.7);
    // Already passing: unchanged.
    expect(suggestForeground(c("#000"), c("#fff"), 7)).toBe("#000000");
    // On mid grey, 15:1 is impossible.
    expect(suggestForeground(c("#888"), c("#888"), 15)).toBeNull();
  });
});

describe("color scale", () => {
  it("builds 50–950 with the input on its closest step", () => {
    const scale = colorScale(parseColor("#3b82f6")!);
    expect(scale.map((s) => s.step)).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
    const base = scale.find((s) => s.base)!;
    expect(base.hex).toBe("#3b82f6");
    expect(base.step).toBe(500);
    // Lightness decreases monotonically.
    const ls = scale.map((s) => parseFloat(s.oklch.slice(6)));
    expect(ls.every((l, i) => i === 0 || l < ls[i - 1])).toBe(true);
  });

  it("places a dark input on a dark step", () => {
    const base = colorScale(parseColor("#1e1b4b")!).find((s) => s.base)!;
    expect(base.step).toBe(950);
    expect(base.hex).toBe("#1e1b4b");
  });

  it("exports variables and themes", () => {
    const scale = colorScale(parseColor("#3b82f6")!);
    expect(exportScale("Brand Blue", scale, "css", "hex")).toContain("  --brand-blue-500: #3b82f6;");
    expect(exportScale("brand", scale, "tailwind4")).toMatch(/^@theme \{\n {2}--color-brand-50: oklch\(/);
    expect(exportScale("brand", scale, "tailwind3")).toContain('  500: "#3b82f6",');
    expect(exportScale("", scale, "scss", "hex")).toContain("$brand-500: #3b82f6;");
  });
});

describe("type scale", () => {
  const input: TypeScaleInput = {
    minBase: 16,
    maxBase: 18,
    minRatio: 1.2,
    maxRatio: 1.25,
    minViewport: 360,
    maxViewport: 1280,
    rootFontSize: 16,
    stepsDown: 2,
    stepsUp: 5,
  };

  it("generates fluid steps from largest to smallest", () => {
    const r = typeScale(input);
    if (!r.ok) throw new Error(r.error);
    expect(r.steps.map((s) => s.name)).toEqual(["4xl", "3xl", "2xl", "xl", "lg", "base", "sm", "xs"]);
    const base = r.steps.find((s) => s.name === "base")!;
    expect([base.minPx, base.maxPx]).toEqual([16, 18]);
    expect(base.clamp).toBe("clamp(1rem, 0.9511rem + 0.2174vw, 1.125rem)");
    const top = r.steps[0];
    expect([top.minPx, top.maxPx]).toEqual([39.81, 54.93]);
  });

  it("exports as CSS variables and Tailwind themes", () => {
    const r = typeScale(input);
    if (!r.ok) throw new Error();
    expect(exportTypeScale(r.steps, "css")).toContain("  --step-0: clamp(1rem,");
    expect(exportTypeScale(r.steps, "tailwind4")).toContain("  --text-base: clamp(");
    expect(exportTypeScale(r.steps, "tailwind3")).toContain('  "2xl": "clamp(');
  });

  it("names steps and validates input", () => {
    expect([stepName(-1), stepName(0), stepName(3)]).toEqual(["sm", "base", "2xl"]);
    expect(typeScale({ ...input, minRatio: 1 })).toEqual({ ok: false, error: "ratio" });
    expect(typeScale({ ...input, maxBase: 0 })).toEqual({ ok: false, error: "base" });
    expect(typeScale({ ...input, maxViewport: 100 })).toEqual({ ok: false, error: "viewport" });
    expect(typeScale({ ...input, stepsUp: 11 })).toEqual({ ok: false, error: "steps" });
  });
});

describe("box-shadow", () => {
  it("writes layers", () => {
    expect(layerToCss({ x: 0, y: 4, blur: 12, spread: 0, color: "#0003", inset: false })).toBe("0 4px 12px #0003");
    expect(layerToCss({ x: 1, y: 1, blur: 0, spread: 2, color: "red", inset: true })).toBe("inset 1px 1px 0 2px red");
    expect(shadowToCss([])).toBe("none");
  });

  it("parses multi-layer shadows with functional colors", () => {
    const layers = parseBoxShadow("box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), inset 0 0 0 1px #fff;");
    expect(layers).toEqual([
      { x: 0, y: 1, blur: 3, spread: 0, color: "rgb(0 0 0 / 0.1)", inset: false },
      { x: 0, y: 0, blur: 0, spread: 1, color: "#fff", inset: true },
    ]);
    expect(parseBoxShadow("none")).toEqual([]);
    expect(parseBoxShadow("2px 2px")).toEqual([
      { x: 2, y: 2, blur: 0, spread: 0, color: "currentColor", inset: false },
    ]);
  });

  it("rejects invalid shadows", () => {
    for (const bad of ["", "red", "1px", "0 0 -2px red", "1 2 red", "1px 2px 3px 4px 5px red"])
      expect(parseBoxShadow(bad)).toBeNull();
    expect(splitTopLevel("a(1,2), b")).toEqual(["a(1,2)", "b"]);
  });
});

describe("gradients", () => {
  it("writes linear, radial and conic gradients", () => {
    expect(gradientToCss(DEFAULT_GRADIENT)).toBe("linear-gradient(90deg, #6366f1 0%, #ec4899 100%)");
    expect(gradientToCss({ ...DEFAULT_GRADIENT, type: "radial", x: 30, y: 40 })).toBe(
      "radial-gradient(circle at 30% 40%, #6366f1 0%, #ec4899 100%)",
    );
    expect(gradientToCss({ ...DEFAULT_GRADIENT, type: "conic", angle: 45, repeating: true })).toBe(
      "repeating-conic-gradient(from 45deg at 50% 50%, #6366f1 0%, #ec4899 100%)",
    );
  });

  it("sorts stops by position", () => {
    const g = {
      ...DEFAULT_GRADIENT,
      stops: [
        { color: "b", position: 80 },
        { color: "a", position: 10 },
      ],
    };
    expect(gradientToCss(g)).toBe("linear-gradient(90deg, a 10%, b 80%)");
  });

  it("parses gradients, spreading stops without position", () => {
    expect(parseGradient("background: linear-gradient(to right, red, rgb(0 0 255) 70%, #0f0);")).toMatchObject({
      type: "linear",
      angle: 90,
      stops: [
        { color: "red", position: 0 },
        { color: "rgb(0 0 255)", position: 70 },
        { color: "#0f0", position: 100 },
      ],
    });
    expect(parseGradient("linear-gradient(0.25turn, red, blue)")?.angle).toBe(90);
    expect(parseGradient("linear-gradient(red, blue)")?.angle).toBe(180);
    expect(parseGradient("radial-gradient(ellipse at top left, red, blue)")).toMatchObject({
      shape: "ellipse",
      x: 0,
      y: 0,
    });
    expect(parseGradient("conic-gradient(from 90deg at 25% 75%, red, blue)")).toMatchObject({
      angle: 90,
      x: 25,
      y: 75,
    });
  });

  it("rejects non gradients", () => {
    expect(parseGradient("red")).toBeNull();
    expect(parseGradient("linear-gradient(red)")).toBeNull();
  });
});

describe("cubic-bezier", () => {
  it("parses keywords, functions and plain numbers", () => {
    expect(parseBezier("ease-in-out")).toEqual({ ok: true, bezier: [0.42, 0, 0.58, 1] });
    expect(parseBezier("cubic-bezier(.17,.67,.83,.67)")).toEqual({ ok: true, bezier: [0.17, 0.67, 0.83, 0.67] });
    expect(parseBezier("transition-timing-function: 0.4 0 0.2 1;")).toEqual({ ok: true, bezier: [0.4, 0, 0.2, 1] });
    expect(parseBezier("cubic-bezier(1.2, 0, 0, 1)")).toEqual({ ok: false, error: "x-range" });
    expect(parseBezier("steps(4)")).toEqual({ ok: false, error: "syntax" });
    expect(parseBezier("1 2 3")).toEqual({ ok: false, error: "syntax" });
  });

  it("writes CSS, using keywords when they match", () => {
    expect(bezierToCss([0.25, 0.1, 0.25, 1])).toBe("ease");
    expect(bezierToCss(PRESETS.easeOutBack)).toBe("cubic-bezier(0.34, 1.56, 0.64, 1)");
    expect(bezierToCss([0.123, 0, 1, 1])).toBe("cubic-bezier(0.12, 0, 1, 1)");
  });

  it("evaluates progress over time", () => {
    expect(evaluate(PRESETS.linear, 0.3)).toBeCloseTo(0.3, 5);
    expect(evaluate(PRESETS.ease, 0.5)).toBeCloseTo(0.8024, 3);
    expect(evaluate(PRESETS.easeOutBack, 0.6)).toBeGreaterThan(1);
    expect([evaluate(PRESETS.ease, -1), evaluate(PRESETS.ease, 2)]).toEqual([0, 1]);
  });

  it("draws the curve as an SVG path", () => {
    expect(curvePath([0.25, 0.1, 0.25, 1], 100, 10)).toBe("M 10 110 C 35 100, 35 10, 110 10");
  });
});

describe("px ↔ rem", () => {
  it("converts single values", () => {
    expect(convertUnit(24, "px", "rem")).toBe(1.5);
    expect(convertUnit(1.5, "rem", "px")).toBe(24);
    expect(convertUnit(14, "px", "em", 14)).toBe(1);
    expect(convertUnit(10, "px", "rem", 16, 3)).toBe(0.625);
    expect(convertUnit(0, "px", "rem")).toBe(0);
  });

  it("converts every value in a CSS snippet", () => {
    const css = ".card { padding: 16px 24px; margin: -8px; border: 1px solid; background: url(a-16px.png); }";
    expect(convertCss(css, "px", "rem")).toEqual({
      output: ".card { padding: 1rem 1.5rem; margin: -0.5rem; border: 1px solid; background: url(a-16px.png); }",
      count: 3,
    });
    expect(convertCss("border: 1px", "px", "rem", { keepHairlines: false }).output).toBe("border: 0.0625rem");
    expect(convertCss("gap: 1.25rem 0rem", "rem", "px")).toEqual({ output: "gap: 20px 0", count: 2 });
    expect(convertCss("h1px #12px", "px", "rem").count).toBe(0);
  });

  it("builds a reference table", () => {
    expect(referenceTable(16).find((r) => r.px === 24)?.rem).toBe(1.5);
    expect(referenceTable(10).find((r) => r.px === 24)?.rem).toBe(2.4);
  });
});
