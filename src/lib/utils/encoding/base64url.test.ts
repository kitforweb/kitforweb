import { describe, expect, it } from "vitest";
import { base64UrlToText, bytesToHex, toStandardBase64 } from "./base64url";

describe("toStandardBase64", () => {
  it("adds the missing padding", () => {
    expect(toStandardBase64("YQ")).toBe("YQ==");
    expect(toStandardBase64("YWI")).toBe("YWI=");
    expect(toStandardBase64("YWJj")).toBe("YWJj");
  });

  it("converts the URL-safe alphabet", () => {
    expect(toStandardBase64("-_-_")).toBe("+/+/");
  });

  it("rejects impossible lengths", () => {
    expect(() => toStandardBase64("abcde")).toThrow();
  });
});

describe("base64UrlToText", () => {
  it("decodes unpadded Base64URL with UTF-8", () => {
    // "¿qué?" in UTF-8, Base64URL without padding
    const encoded = Buffer.from("¿qué?").toString("base64url");
    expect(encoded.endsWith("=")).toBe(false);
    expect(base64UrlToText(encoded)).toBe("¿qué?");
  });

  it("throws on invalid UTF-8", () => {
    expect(() => base64UrlToText("_w")).toThrow();
  });
});

describe("bytesToHex", () => {
  it("pads every byte", () => {
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe("000fff");
  });
});
