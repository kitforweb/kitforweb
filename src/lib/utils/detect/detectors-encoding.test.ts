import { describe, expect, it } from "vitest";
import {
  detectBase64,
  detectEncodedText,
  detectGzip,
  detectIdn,
  detectInvisibleChars,
  detectKind,
  detectRadix,
} from "./detectors";
import { resolveDetections } from "./resolve";

describe("detectGzip", () => {
  it("recognises gzip data in Base64", () => {
    expect(detectGzip("H4sIAAAAAAAAA8vIzMlXyM9LBQAv9WXHCQAAAA==")).toEqual({ kind: "gzip", confidence: 0.95 });
  });

  it("wins over plain Base64", () => {
    expect(detectBase64("H4sIAAAAAAAAA8vIzMlXyM9LBQAv9WXHCQAAAA==")).toBeNull();
    expect(detectKind("H4sIAAAAAAAAA8vIzMlXyM9LBQAv9WXHCQAAAA==")?.kind).toBe("gzip");
  });

  it("ignores other Base64 and short strings", () => {
    expect(detectGzip("aGVsbG8gd29ybGQ=")).toBeNull();
    expect(detectGzip("H4sI")).toBeNull();
  });
});

describe("detectIdn", () => {
  it.each(["españa.com", "münchen.de", "xn--espaa-rta.com", "info@niño.com", "例え.テスト"])("detects %s", (input) => {
    expect(detectIdn(input)?.kind).toBe("idn");
  });

  it.each(["example.com", "josé@example.com", "https://ñ.com/x", "hola mundo.com", "ñ"])("ignores %s", (input) => {
    expect(detectIdn(input)).toBeNull();
  });
});

describe("detectRadix", () => {
  it.each([
    ["0xFF", 0.9],
    ["-0b1010", 0.9],
    ["0o755", 0.9],
    ["01001000 01101001", 0.9],
    ["48 65 6c 6c 6f", 0.7],
  ])("detects %s", (input, confidence) => {
    expect(detectRadix(input)).toEqual({ kind: "radix", confidence });
  });

  it.each(["0xZZ", "1010", "48 65", "0x"])("ignores %s", (input) => {
    expect(detectRadix(input)).toBeNull();
  });
});

describe("detectInvisibleChars", () => {
  it.each([
    ["zero width space", "pass\u200Bword"],
    ["BOM", '\uFEFF{"a":1}'],
    ["right-to-left override", "invoice\u202Etxt.exe"],
    ["soft hyphen", "co\u00ADoperate"],
  ])("detects a %s", (_, input) => {
    expect(detectInvisibleChars(input)?.kind).toBe("invisible-chars");
  });

  it("ignores normal text, including non-breaking spaces", () => {
    expect(detectInvisibleChars("hola qué tal\u00A0😀")).toBeNull();
  });
});

describe("detectEncodedText defers to better tools", () => {
  it("leaves URLs and HTML documents alone", () => {
    expect(detectEncodedText("https://a.com/?q=caf%C3%A9")).toBeNull();
    expect(detectEncodedText("<p>Tom &amp; Jerry</p>")).toBeNull();
  });

  it("still detects loose encoded text", () => {
    expect(detectEncodedText("caf%C3%A9%20con%20leche")?.kind).toBe("url-encoded");
    expect(detectEncodedText("Tom &amp; Jerry")?.kind).toBe("html-entities");
  });
});

describe("resolveDetections with a clear margin", () => {
  const map: Record<string, string> = {
    url: "url-params",
    "url-encoded": "url-encode",
    json: "json-format",
    "invisible-chars": "unicode",
  };
  const toolFor = (k: string) => map[k];

  it("navigates when the best candidate is clearly ahead", () => {
    expect(resolveDetections("https://a.com/?q=a%20b", toolFor).auto?.toolId).toBe("url-params");
  });

  it("offers chips when two candidates are close", () => {
    const r = resolveDetections('\uFEFF{"a":1}', toolFor);
    expect(r.auto).toBeNull();
    expect(r.candidates.map((c) => c.toolId).sort()).toEqual(["json-format", "unicode"]);
  });
});
