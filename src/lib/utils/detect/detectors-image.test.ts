import { describe, expect, it } from "vitest";
import { detectAll, detectQrPayload, detectSvg, detectXml } from "./detectors";
import { resolveDetections } from "./resolve";

const TOOLS: Record<string, string> = {
  svg: "svg-optimize",
  "qr-payload": "qr",
  xml: "xml-format",
  html: "html-to-jsx",
};
const resolve = (input: string) => resolveDetections(input, (k) => TOOLS[k]);

describe("detectSvg", () => {
  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0"/></svg>',
    '<?xml version="1.0"?>\n<!-- Generator: Figma -->\n<svg width="10" height="10"></svg>',
    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">\n<svg><g/></svg>',
    "<svg/>",
  ])("opens SVG %# in the optimizer, not as XML", (input) => {
    expect(detectSvg(input)?.kind).toBe("svg");
    expect(detectXml(input)).toBeNull();
    expect(resolve(input).auto?.toolId).toBe("svg-optimize");
  });

  it("leaves other XML and truncated SVG alone", () => {
    expect(detectSvg("<?xml version='1.0'?><feed></feed>")).toBeNull();
    expect(detectSvg("<svg><path d='M0 0'")).toBeNull();
    expect(resolve("<?xml version='1.0'?><feed></feed>").auto?.toolId).toBe("xml-format");
  });
});

describe("detectQrPayload", () => {
  it.each(["WIFI:T:WPA;S:Home;P:secret;;", "BEGIN:VCARD\nVERSION:3.0\nFN:Ada\nEND:VCARD", "MECARD:N:Ada;;"])(
    "opens %s in the QR generator",
    (input) => {
      expect(resolve(input).auto?.toolId).toBe("qr");
    },
  );

  it("ignores text that merely mentions wifi", () => {
    expect(detectQrPayload("wifi password: 1234")).toBeNull();
    expect(detectAll("BEGIN:VEVENT\nEND:VEVENT").map((d) => d.kind)).not.toContain("qr-payload");
  });
});
