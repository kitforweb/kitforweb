import { describe, expect, it } from "vitest";
import { outputName, savings, scaledSize } from "./convert";
import { buildIco, fitRect, ICON_SPECS, linkTags, webManifest } from "./favicon";
import { qrMatrix, qrSvg, vcardPayload, wifiPayload } from "./qr";
import { DEFAULT_SVG_OPTIONS, optimizeSvg } from "./svg-optimize";
import { DEFAULT_REACT_OPTIONS, svgToReact } from "./svg-to-react";

const ICON = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Illustrator -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24" height="24" viewBox="0 0 24 24">
  <title>Check</title>
  <metadata>editor stuff</metadata>
  <g>
    <g>
      <path fill="#1E293B" stroke-width="2.000000" d="M 4.000000 12.500000 L 9.123456 17.654321 L 20.000000 6.000000"/>
    </g>
  </g>
</svg>`;

describe("SVG optimizer", () => {
  it("removes metadata, comments and extra groups, and rounds numbers", () => {
    const r = optimizeSvg({ svg: ICON, options: DEFAULT_SVG_OPTIONS });
    if (!r.ok) throw new Error(r.error);
    expect(r.output).not.toContain("<!--");
    expect(r.output).not.toContain("metadata");
    expect(r.output).not.toContain("<g");
    expect(r.output).toContain('d="m4 12.5 5.12 5.15L20 6"');
    expect(r.output).not.toContain("9.123456");
    expect(r.output).toContain('viewBox="0 0 24 24"');
    expect(r.output).toContain("<title>Check</title>");
    expect(r.after).toBeLessThan(r.before);
    expect(r.saved).toBeGreaterThan(30);
  });

  it("can drop the title and viewBox and pretty-print", () => {
    const r = optimizeSvg({
      svg: ICON,
      options: { ...DEFAULT_SVG_OPTIONS, keepTitle: false, keepViewBox: false, pretty: true },
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.output).not.toContain("<title>");
    expect(r.output).not.toContain("viewBox");
    expect(r.output.split("\n").length).toBeGreaterThan(2);
  });

  it("reports invalid input", () => {
    expect(optimizeSvg({ svg: "<div></div>", options: DEFAULT_SVG_OPTIONS })).toEqual({ ok: false, error: "not-svg" });
    const broken = optimizeSvg({ svg: "<svg><path></svg>", options: DEFAULT_SVG_OPTIONS });
    expect(broken.ok).toBe(false);
  });
});

describe("SVG → React", () => {
  it("builds a typed component with size and currentColor", () => {
    const r = svgToReact(ICON, { ...DEFAULT_REACT_OPTIONS, name: "CheckIcon" });
    if (!r.ok) throw new Error(r.error);
    expect(r.output).toContain('import { type SVGProps } from "react";');
    expect(r.output).toContain(
      "export default function CheckIcon({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) {",
    );
    expect(r.output).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} {...props}>',
    );
    expect(r.output).toContain('fill="currentColor" strokeWidth="2.000000"');
    expect(r.output).not.toContain("xmlns:xlink");
    expect(r.output).not.toContain("<!--");
    expect(r.colors).toEqual(["#1e293b"]);
  });

  it("writes plain JSX, keeps colors and wraps in memo on demand", () => {
    const r = svgToReact('<svg width="10" style="fill: red"><circle fill="url(#g)" r="2"/></svg>', {
      name: "Dot",
      typescript: false,
      currentColor: false,
      sizeProp: false,
      memo: true,
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.output).toBe(
      'import { memo } from "react";\n\nfunction Dot(props) {\n  return (\n    <svg width="10" style={{ fill: "red" }} {...props}>\n      <circle fill="url(#g)" r="2" />\n    </svg>\n  );\n}\n\nexport default memo(Dot);\n',
    );
  });

  it("replaces colors inside style attributes", () => {
    const r = svgToReact('<svg><path style="fill:#000;stroke:none"/></svg>');
    expect(r.ok && r.output).toContain('style={{ fill: "currentColor", stroke: "none" }}');
  });

  it("rejects non-SVG input and bad names", () => {
    expect(svgToReact("<div/>")).toEqual({ ok: false, error: "not-svg" });
    expect(svgToReact(ICON, { ...DEFAULT_REACT_OPTIONS, name: "check-icon" })).toEqual({ ok: false, error: "name" });
  });
});

describe("favicon", () => {
  it("packs PNGs into an ICO with a valid directory", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5]);
    const ico = buildIco([
      { size: 16, png: a },
      { size: 256, png: b },
    ]);
    const v = new DataView(ico.buffer);
    expect([v.getUint16(0, true), v.getUint16(2, true), v.getUint16(4, true)]).toEqual([0, 1, 2]);
    expect(ico[6]).toBe(16);
    expect(ico[22]).toBe(0); // 256 is stored as 0
    expect(v.getUint32(6 + 8, true)).toBe(3);
    expect(v.getUint32(6 + 12, true)).toBe(38);
    expect(v.getUint32(22 + 12, true)).toBe(41);
    expect([...ico.slice(38)]).toEqual([1, 2, 3, 4, 5]);
  });

  it("writes the manifest and the link tags", () => {
    const m = JSON.parse(webManifest({ name: "Kit", shortName: "", themeColor: "#111", backgroundColor: "#fff" }));
    expect(m.short_name).toBe("Kit");
    expect(m.icons.map((i: { purpose?: string }) => i.purpose ?? "any")).toEqual(["any", "any", "maskable"]);
    expect(linkTags(true, "#111")).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
    expect(linkTags(false, '"x')).not.toContain("favicon.svg");
    expect(linkTags(false, '"x')).toContain('content="&quot;x"');
    expect(ICON_SPECS.find((s) => s.maskable)?.size).toBe(512);
  });

  it("fits images inside the padded square", () => {
    expect(fitRect(200, 100, 100, 0)).toEqual({ x: 0, y: 25, w: 100, h: 50 });
    expect(fitRect(100, 100, 100, 0.1)).toEqual({ x: 10, y: 10, w: 80, h: 80 });
  });
});

describe("QR", () => {
  it("builds WiFi payloads with escaping", () => {
    expect(wifiPayload({ ssid: "Home;5G", password: 'p:a"ss', encryption: "WPA", hidden: true })).toBe(
      'WIFI:T:WPA;S:Home\\;5G;P:p\\:a\\"ss;H:true;;',
    );
    expect(wifiPayload({ ssid: "Cafe", password: "x", encryption: "nopass", hidden: false })).toBe(
      "WIFI:T:nopass;S:Cafe;;",
    );
  });

  it("builds vCards without empty fields", () => {
    const v = vcardPayload({
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "+44 20 1234",
      email: "",
      org: "A, B",
      url: "",
    });
    expect(v.split("\r\n")).toEqual([
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Lovelace;Ada;;;",
      "FN:Ada Lovelace",
      "ORG:A\\, B",
      "TEL;TYPE=CELL:+44201234",
      "END:VCARD",
    ]);
  });

  it("creates the module matrix and an SVG", () => {
    const r = qrMatrix("https://kitforweb.com", "M");
    if (!r.ok) throw new Error(r.error);
    expect(r.qr.size).toBe(25); // version 2
    expect(r.qr.modules).toHaveLength(625);
    // Finder pattern: the top-left corner is dark.
    expect(r.qr.modules[0]).toBe(true);
    const svg = qrSvg(r.qr, { fg: "#000", bg: "#fff", margin: 4 });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 33 33"/);
    expect(svg).toContain('<path fill="#000" d="M4 4h7v1h-7z');
  });

  it("clears the center for a logo", () => {
    const r = qrMatrix("logo", "H");
    if (!r.ok) throw new Error();
    const plain = qrSvg(r.qr, { fg: "#000", bg: "#fff", margin: 0 });
    const withLogo = qrSvg(r.qr, { fg: "#000", bg: "#fff", margin: 0, logo: { href: "data:x", ratio: 0.2 } });
    expect(withLogo.length - withLogo.indexOf("<image")).toBeGreaterThan(0);
    expect(withLogo.split("M").length).toBeLessThan(plain.split("M").length + 10);
  });

  it("rejects empty and oversized content", () => {
    expect(qrMatrix("", "M")).toEqual({ ok: false, error: "empty" });
    expect(qrMatrix("x".repeat(5000), "H")).toEqual({ ok: false, error: "too-long" });
  });
});

describe("image conversion helpers", () => {
  it("names outputs, measures savings and scales down", () => {
    expect(outputName("photo.final.JPG", "webp")).toBe("photo.final.webp");
    expect(outputName("scan", "jpeg")).toBe("scan.jpg");
    expect(savings(1000, 250)).toBe(75);
    expect(savings(100, 150)).toBe(-50);
    expect(savings(0, 10)).toBe(0);
    expect(scaledSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(scaledSize(800, 600, 0)).toEqual({ width: 800, height: 600 });
  });
});
