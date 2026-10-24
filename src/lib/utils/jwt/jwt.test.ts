import { describe, expect, it } from "vitest";
import { SignJWT, exportSPKI, generateKeyPair, exportJWK } from "jose";
import { decodeJwt, jwtStatus, timeClaims } from "./decode";
import { verifyJwt } from "./verify";

// Classic jwt.io example (HS256, secret "your-256-bit-secret").
const HS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("decodeJwt", () => {
  it("decodes header and payload", () => {
    const r = decodeJwt(HS_TOKEN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.jwt.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(r.jwt.payload).toMatchObject({ sub: "1234567890", name: "John Doe" });
    expect(r.jwt.signature).toBe("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  });

  it("accepts a Bearer prefix and whitespace", () => {
    expect(decodeJwt(`  Bearer ${HS_TOKEN}\n`).ok).toBe(true);
  });

  it("handles unpadded Base64URL with UTF-8 characters", () => {
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const token = `${enc({ alg: "none" })}.${enc({ name: "José Ñúñez" })}.`;
    const r = decodeJwt(token);
    expect(r.ok && r.jwt.payload).toEqual({ name: "José Ñúñez" });
  });

  it("reports which part is broken", () => {
    expect(decodeJwt("abc")).toEqual({ ok: false, error: "parts" });
    expect(decodeJwt("bm9wZQ.e30.x")).toEqual({ ok: false, error: "header" });
  });
});

describe("time claims", () => {
  const now = new Date("2024-01-01T00:00:00Z");
  const t = now.getTime() / 1000;

  it("lists iat, nbf and exp as dates", () => {
    const claims = timeClaims({ iat: 1516239022, exp: 1516242622 });
    expect(claims.map((c) => c.claim)).toEqual(["iat", "exp"]);
    expect(claims[0].date.toISOString()).toBe("2018-01-18T01:30:22.000Z");
  });

  it("computes the status", () => {
    expect(jwtStatus({ exp: t - 1 }, now)).toBe("expired");
    expect(jwtStatus({ exp: t + 60 }, now)).toBe("valid");
    expect(jwtStatus({ nbf: t + 60, exp: t + 120 }, now)).toBe("not-yet-valid");
    expect(jwtStatus({ sub: "x" }, now)).toBe("no-expiry");
    expect(jwtStatus("text", now)).toBe("no-expiry");
  });
});

describe("verifyJwt", () => {
  it("verifies an HMAC signature with the right secret", async () => {
    expect(await verifyJwt(HS_TOKEN, "HS256", "your-256-bit-secret")).toEqual({ ok: true });
    expect(await verifyJwt(HS_TOKEN, "HS256", "wrong")).toEqual({ ok: false, reason: "signature" });
  });

  it("verifies RS256 with a PEM public key and with a JWK", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
    const token = await new SignJWT({ sub: "42" }).setProtectedHeader({ alg: "RS256" }).sign(privateKey);
    const pem = await exportSPKI(publicKey);
    const jwk = JSON.stringify(await exportJWK(publicKey));
    expect(await verifyJwt(token, "RS256", pem)).toEqual({ ok: true });
    expect(await verifyJwt(token, "RS256", jwk)).toEqual({ ok: true });
    expect(await verifyJwt(token, "RS256", "not a key")).toEqual({ ok: false, reason: "key" });
  });

  it("refuses alg none", async () => {
    expect(await verifyJwt("e30.e30.", "none", "")).toEqual({ ok: false, reason: "alg" });
  });
});
