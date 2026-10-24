import { describe, expect, it } from "vitest";
import { buildClamp, evaluateClamp, type ClampInput } from "./clamp";

const base: ClampInput = { minSize: 16, maxSize: 24, minViewport: 320, maxViewport: 1280, rootFontSize: 16 };

describe("buildClamp", () => {
  it("mixes rem and vw", () => {
    const r = buildClamp(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // slope = 8 / 960 = 0.008333 → 0.8333vw ; intercept = 16 - 0.008333*320 = 13.333px = 0.8333rem
    expect(r.result.css).toBe("clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)");
  });

  it("hits the exact sizes at both viewport limits", () => {
    const r = buildClamp(base);
    if (!r.ok) throw new Error();
    expect(evaluateClamp(r.result, 320, 16)).toBeCloseTo(16, 2);
    expect(evaluateClamp(r.result, 1280, 16)).toBeCloseTo(24, 2);
    expect(evaluateClamp(r.result, 2000, 16)).toBe(24);
    expect(evaluateClamp(r.result, 100, 16)).toBe(16);
  });

  it("supports values that shrink as the viewport grows", () => {
    const r = buildClamp({ ...base, minSize: 32, maxSize: 16 });
    if (!r.ok) throw new Error();
    expect(r.result.css).toBe("clamp(1rem, 2.3333rem - 1.6667vw, 2rem)");
    expect(evaluateClamp(r.result, 320, 16)).toBeCloseTo(32, 2);
  });

  it("omits the slope when sizes are equal", () => {
    const r = buildClamp({ ...base, maxSize: 16 });
    expect(r.ok && r.result.css).toBe("clamp(1rem, 1rem, 1rem)");
  });

  it("validates its input", () => {
    expect(buildClamp({ ...base, maxViewport: 320 })).toEqual({ ok: false, error: "viewport" });
    expect(buildClamp({ ...base, rootFontSize: 0 })).toEqual({ ok: false, error: "root" });
    expect(buildClamp({ ...base, minSize: Number.NaN })).toEqual({ ok: false, error: "nan" });
  });
});
