import { describe, expect, it } from "vitest";
import { detectBase64, detectBcrypt, detectJwk, detectKind, detectPem, detectRegex } from "./detectors";
import { resolveDetections } from "./resolve";

describe("detectPem splits certificates and keys", () => {
  it.each([
    ["-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----", "pem"],
    ["-----BEGIN PUBLIC KEY-----\nMFkw\n-----END PUBLIC KEY-----", "pem-key"],
    ["-----BEGIN PRIVATE KEY-----\nMIGH\n-----END PRIVATE KEY-----", "pem-key"],
    ["-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----", "pem-key"],
  ])("%#", (input, kind) => {
    expect(detectPem(input)?.kind).toBe(kind);
  });

  it("ignores a lone header", () => {
    expect(detectPem("-----BEGIN CERTIFICATE-----")).toBeNull();
  });
});

describe("detectBcrypt", () => {
  const hash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

  it("detects bcrypt hashes of every version", () => {
    expect(detectBcrypt(hash)).toEqual({ kind: "bcrypt", confidence: 0.98 });
    expect(detectBcrypt(hash.replace("$2a$", "$2b$"))?.kind).toBe("bcrypt");
    expect(detectKind(`  ${hash}\n`)?.kind).toBe("bcrypt");
  });

  it("ignores truncated hashes and other crypt formats", () => {
    expect(detectBcrypt(hash.slice(0, -1))).toBeNull();
    expect(detectBcrypt("$6$rounds=5000$salt$hash")).toBeNull();
    expect(detectBase64(hash)).toBeNull();
  });
});

describe("detectJwk", () => {
  it("detects public and private JWKs", () => {
    expect(detectJwk('{"kty":"EC","crv":"P-256","x":"a","y":"b"}')?.kind).toBe("jwk");
    expect(detectJwk('{ "kty": "RSA", "n": "x", "e": "AQAB", "d": "y" }')?.kind).toBe("jwk");
  });

  it("ignores other JSON", () => {
    expect(detectJwk('{"name":"kty"}')).toBeNull();
    expect(detectJwk('{"kty": 1}')).toBeNull();
    expect(detectJwk('{"kty":')).toBeNull();
  });

  it("is offered next to the JSON formatter", () => {
    const r = resolveDetections(
      '{"kty":"oct","k":"abc"}',
      (k) => ({ jwk: "keypair", json: "json-format" })[k as string],
    );
    expect(r.candidates.map((c) => c.toolId)).toEqual(["keypair", "json-format"]);
  });
});

describe("detectRegex", () => {
  it.each(["/^\d{4}-\d{2}$/", "/colou?r/gi", "/[a-z]+/", "/(foo|bar)/u"])("detects %s", (input) => {
    expect(detectRegex(input)?.kind).toBe("regex");
  });

  it.each(["/api/users/", "/usr/local/bin", "/(/", "/a/b/c/x"])("ignores %s", (input) => {
    expect(detectRegex(input)).toBeNull();
  });
});
