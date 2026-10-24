import { describe, expect, it } from "vitest";
import { detectAll, detectBoxShadow, detectCssLength, detectCubicBezier, detectGradient } from "./detectors";
import { resolveDetections } from "./resolve";

const TOOLS: Record<string, string> = {
  color: "color-converter",
  "css-length": "px-rem",
  "box-shadow": "box-shadow",
  gradient: "gradient",
  "cubic-bezier": "cubic-bezier",
  timestamp: "timestamp",
};
const resolve = (input: string) => resolveDetections(input, (k) => TOOLS[k]);

describe("CSS detectors", () => {
  it.each([
    ["#3b82f6", "color-converter"],
    ["oklch(62% 0.19 260)", "color-converter"],
    ["24px", "px-rem"],
    ["1.5rem 2rem", "px-rem"],
    ["box-shadow: 0 1px 3px rgb(0 0 0 / .1)", "box-shadow"],
    ["0 4px 12px rgba(0,0,0,.2), inset 0 0 0 1px #fff", "box-shadow"],
    ["linear-gradient(90deg, #6366f1, #ec4899)", "gradient"],
    ["background: repeating-conic-gradient(red, blue 25%)", "gradient"],
    ["cubic-bezier(0.34, 1.56, 0.64, 1)", "cubic-bezier"],
  ])("opens %s in %s", (input, tool) => {
    expect(resolve(input).auto?.toolId).toBe(tool);
  });

  it("does not detect what is not CSS", () => {
    expect(detectCssLength("24")).toBeNull();
    expect(detectCssLength("24 px")).toBeNull();
    expect(detectBoxShadow("0 4px")).toBeNull();
    expect(detectBoxShadow("box-shadow: banana")).toBeNull();
    expect(detectGradient("linear-gradient(red)")).toBeNull();
    expect(detectCubicBezier("ease")).toBeNull();
    expect(detectCubicBezier("cubic-bezier(2, 0, 0, 1)")).toBeNull();
  });

  it("keeps a plain number as a timestamp, not a length", () => {
    expect(detectAll("1700000000").map((d) => d.kind)).not.toContain("css-length");
  });
});
