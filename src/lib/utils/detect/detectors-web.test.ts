import { describe, expect, it } from "vitest";
import { detectHttpStatus, detectKind, detectSemver, detectUserAgent } from "./detectors";

describe("detectUserAgent", () => {
  it.each([
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "PostmanRuntime/7.39.0",
    "okhttp/4.12.0",
  ])("detects %s", (ua) => {
    expect(detectUserAgent(ua)?.kind).toBe("user-agent");
  });

  it("wins the overall detection for browser strings", () => {
    expect(detectKind("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15")?.kind).toBe(
      "user-agent",
    );
  });

  it.each(["Mozilla", "Mozilla/5.0\nsecond line", "Hello world/1.0"])("ignores %s", (input) => {
    expect(detectUserAgent(input)).toBeNull();
  });
});

describe("detectSemver", () => {
  it.each([
    ["1.4.0", 0.7],
    ["v2.0.0-beta.1+build.5", 0.7],
    ["^1.2.3", 0.9],
    ["~0.2", 0.9],
    [">=1.0.0 <2.0.0", 0.9],
    ["^1.2.3 || 2.x", 0.9],
    ["1.x", 0.9],
  ])("detects %s", (input, confidence) => {
    expect(detectSemver(input)).toEqual({ kind: "semver", confidence });
  });

  it.each(["1.2", "192.168.1.1", "^", "a.b.c", ">= banana", "1.2.3.4"])("ignores %s", (input) => {
    expect(detectSemver(input)).toBeNull();
  });
});

describe("detectHttpStatus", () => {
  it("offers three-digit status codes with low confidence", () => {
    expect(detectHttpStatus("404")).toEqual({ kind: "http-status", confidence: 0.6 });
    expect(detectHttpStatus(" 503 ")).toEqual({ kind: "http-status", confidence: 0.6 });
  });

  it.each(["600", "99", "4040", "abc"])("ignores %s", (input) => {
    expect(detectHttpStatus(input)).toBeNull();
  });
});
