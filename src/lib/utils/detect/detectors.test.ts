import { describe, expect, it } from "vitest";
import {
  detectAll,
  detectBase64,
  detectColor,
  detectCron,
  detectCurl,
  detectDockerRun,
  detectEncodedText,
  detectEnv,
  detectHtml,
  detectHttpHeaders,
  detectIsoDate,
  detectJson,
  detectJwt,
  detectKind,
  detectMermaid,
  detectPem,
  detectSql,
  detectTimestamp,
  detectUrl,
  detectUuid,
  detectXml,
} from "./detectors";
import { resolveDetections } from "./resolve";

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("detectJwt", () => {
  it("detects real tokens", () => {
    expect(detectJwt(JWT)?.kind).toBe("jwt");
    expect(detectJwt(`Bearer ${JWT}`)?.kind).toBe("jwt");
  });

  it("decodes headers whose Base64URL needs padding", () => {
    // {"alg":"none"} → eyJhbGciOiJub25lIn0 (19 chars, needs one "=")
    expect(detectJwt("eyJhbGciOiJub25lIn0.e30.")?.kind).toBe("jwt");
  });

  it("ignores look-alikes", () => {
    expect(detectJwt("www.example.com")).toBeNull();
    expect(detectJwt("1.2.3")).toBeNull();
    expect(detectJwt("e30.e30.e30")).toBeNull(); // header without alg
  });
});

describe("single-purpose detectors", () => {
  it.each([
    [detectCurl, "curl 'https://api.x.com/v1' -H 'accept: */*'", "curl"],
    [detectDockerRun, "docker run -d -p 80:80 nginx", "docker-run"],
    [detectPem, "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----", "pem"],
    [detectUrl, "https://example.com/path?a=1&b=2#frag", "url"],
    [detectHttpHeaders, "HTTP/2 200\ncontent-type: text/html\ncache-control: no-cache", "http-headers"],
    [detectHttpHeaders, "Content-Type: application/json\nX-Frame-Options: DENY", "http-headers"],
    [detectTimestamp, "1700000000", "timestamp"],
    [detectTimestamp, "1700000000123", "timestamp"],
    [detectIsoDate, "2024-05-01T10:20:30Z", "iso-date"],
    [detectIsoDate, "2024-05-01", "iso-date"],
    [detectUuid, "0190a5b8-6e1f-7c3a-9b2d-4e5f6a7b8c9d", "uuid"],
    [detectColor, "#0ff", "color"],
    [detectColor, "oklch(0.8 0.15 200)", "color"],
    [detectCron, "*/5 * * * *", "cron"],
    [detectCron, "@daily", "cron"],
    [detectMermaid, "graph TD\n  A --> B", "mermaid"],
    [detectMermaid, "%% comment\nsequenceDiagram\n  A->>B: hi", "mermaid"],
    [detectMermaid, "---\ntitle: x\n---\nflowchart LR\n  A-->B", "mermaid"],
    [detectSql, "select * from users where id = 1", "sql"],
    [detectSql, "CREATE TABLE users (id int)", "sql"],
    [detectXml, '<?xml version="1.0"?><a/>', "xml"],
    [detectXml, "<note><to>Tove</to></note>", "xml"],
    [detectJson, '{"a":1}', "json"],
    [detectJson, "[1,2", "json"],
    [detectHtml, "<!DOCTYPE html><html></html>", "html"],
    [detectHtml, '<div class="x">hi</div>', "html"],
    [detectEnv, "API_KEY=abc\n# comment\nDEBUG=true", "env"],
    [detectEncodedText, "hello%20world%21", "url-encoded"],
    [detectEncodedText, "Tom &amp; Jerry", "html-entities"],
    [detectBase64, "aGVsbG8gd29ybGQ=", "base64"],
  ])("%#: detects %s", (detector, input, kind) => {
    expect(detector(input)?.kind).toBe(kind);
  });
});

describe("traps", () => {
  it("does not mistake numbers for timestamps out of range", () => {
    expect(detectTimestamp("1234567")).toBeNull();
    expect(detectTimestamp("9999999999")).toBeNull();
  });

  it("does not treat HTML as XML", () => {
    expect(detectXml("<div><p>x</p></div>")).toBeNull();
  });

  it("does not treat plain words as Base64", () => {
    expect(detectBase64("password")).toBeNull();
    expect(detectBase64("12345678")).toBeNull();
  });

  it("does not treat JSON objects as headers", () => {
    expect(detectHttpHeaders('{\n"a": 1,\n"b": 2\n}')).toBeNull();
  });

  it("does not treat URLs with spaces or no scheme as URLs", () => {
    expect(detectUrl("example.com")).toBeNull();
    expect(detectUrl("https://a.com b")).toBeNull();
  });

  it("returns nothing for empty input", () => {
    expect(detectAll("   ")).toEqual([]);
    expect(detectKind("")).toBeNull();
  });

  it("prefers the most confident kind", () => {
    expect(detectKind(JWT)?.kind).toBe("jwt");
    expect(detectKind('{"a": 1}')?.kind).toBe("json");
    expect(detectKind("graph TD\nA-->B")?.kind).toBe("mermaid");
  });
});

describe("resolveDetections", () => {
  const map = { jwt: "jwt-decoder", json: "json-format", timestamp: "timestamp" } as const;
  const toolFor = (k: string) => (map as Record<string, string>)[k];

  it("navigates directly on a single confident match", () => {
    const r = resolveDetections(JWT, toolFor);
    expect(r.auto?.toolId).toBe("jwt-decoder");
  });

  it("sends broken JSON to the validator without auto-navigating", () => {
    const r = resolveDetections('{"a": 1,', toolFor);
    expect(r.auto).toBeNull();
    expect(r.candidates[0]?.toolId).toBe("json-format");
  });

  it("ignores kinds without a tool", () => {
    const r = resolveDetections("docker run nginx", toolFor);
    expect(r).toEqual({ auto: null, candidates: [] });
  });
});
