import "reflect-metadata";
import { webcrypto } from "node:crypto";
import * as x509 from "@peculiar/x509";
import { describe, expect, it } from "vitest";
import { bcryptCompare, bcryptHash, exceedsBcryptLimit, parseBcrypt } from "./bcrypt";
import { findMatch, hashAll, sriFromDigest } from "./hash";
import { decodeKey, hmac, signatureMatches } from "./hmac";
import { generateKeyPairPem, jwkToPem, pemToJwk } from "./keys";
import { activeSets, entropyBits, generatePassword, generateSecret, randomInt, strength } from "./password";
import { formatUuid, generateUuids, inspectUuid } from "./uuid";
import { parseCertificates, splitPem } from "./x509";

describe("Hash", () => {
  it("computes the standard test vectors for 'abc'", async () => {
    const d = Object.fromEntries((await hashAll("abc")).map((x) => [x.algorithm, x.hex]));
    expect(d.MD5).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(d["SHA-1"]).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(d["SHA-256"]).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(d["SHA-512"]).toMatch(/^ddaf35a193617aba/);
  });

  it("hashes the empty string and binary input", async () => {
    const empty = await hashAll("");
    expect(empty.find((x) => x.algorithm === "MD5")?.hex).toBe("d41d8cd98f00b204e9800998ecf8427e");
    const bin = await hashAll(new Uint8Array([0, 255]));
    expect(bin).toHaveLength(5);
  });

  it("builds SRI values and finds matching expected hashes", async () => {
    const d = await hashAll("abc");
    const sha384 = d.find((x) => x.algorithm === "SHA-384")!;
    expect(sriFromDigest(sha384)).toMatch(/^sha384-[A-Za-z0-9+/]+=*$/);
    expect(sriFromDigest(d[0])).toBeNull();
    expect(findMatch(d, "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD")).toBe("SHA-256");
    expect(findMatch(d, sriFromDigest(sha384)!)).toBe("SHA-384");
    expect(findMatch(d, "md5:900150983cd24fb0d6963f7d28e17f72")).toBe("MD5");
    expect(findMatch(d, "deadbeef")).toBeNull();
    expect(findMatch(d, "  ")).toBeNull();
  });
});

describe("HMAC", () => {
  it("matches RFC 4231 test case 2", async () => {
    const r = await hmac("what do ya want for nothing?", "Jefe", "SHA-256");
    expect(r.ok && r.hex).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  });

  it("accepts hex and Base64 keys, and an empty key", async () => {
    const a = await hmac("msg", "Jefe", "SHA-256");
    const b = await hmac("msg", "4a656665", "SHA-256", "hex");
    const c = await hmac("msg", "SmVmZQ==", "SHA-256", "base64");
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect((await hmac("msg", "", "SHA-256")).ok).toBe(true);
  });

  it("rejects malformed keys", async () => {
    expect(decodeKey("xyz", "hex")).toBeNull();
    expect(await hmac("m", "abc", "SHA-256", "hex")).toEqual({ ok: false, error: "key" });
  });

  it("compares webhook signatures in GitHub and Stripe formats", async () => {
    const r = await hmac("payload", "secret", "SHA-256");
    if (!r.ok) throw new Error();
    expect(signatureMatches(`sha256=${r.hex}`, r)).toBe(true);
    expect(signatureMatches(`t=1700000000,v1=${r.hex}`, r)).toBe(true);
    expect(signatureMatches(r.base64, r)).toBe(true);
    expect(signatureMatches("sha256=00", r)).toBe(false);
  });
});

describe("UUID", () => {
  it("generates valid v4 and v7 UUIDs in bulk", () => {
    const fmt = { uppercase: false, hyphens: true, braces: false };
    const v4 = generateUuids(4, 50, fmt);
    expect(new Set(v4).size).toBe(50);
    expect(v4.every((u) => inspectUuid(u)?.version === 4)).toBe(true);
    const v7 = generateUuids(7, 3, fmt);
    expect(v7.every((u) => inspectUuid(u)?.version === 7)).toBe(true);
    expect([...v7].sort()).toEqual(v7); // time-ordered
  });

  it("clamps the count and formats", () => {
    expect(generateUuids(4, 0, { uppercase: false, hyphens: true, braces: false })).toHaveLength(1);
    expect(generateUuids(4, 5000, { uppercase: false, hyphens: true, braces: false })).toHaveLength(1000);
    expect(formatUuid("0190a5b8-6e1f-7c3a-9b2d-4e5f6a7b8c9d", { uppercase: true, hyphens: false, braces: true })).toBe(
      "{0190A5B86E1F7C3A9B2D4E5F6A7B8C9D}",
    );
  });

  it("inspects versions, variants and embedded timestamps", () => {
    const v7 = inspectUuid("0190a5b8-6e1f-7c3a-9b2d-4e5f6a7b8c9d");
    expect(v7).toMatchObject({ version: 7, variant: "RFC 9562" });
    expect(v7?.timestamp?.toISOString()).toBe("2024-07-12T06:54:05.855Z");
    const v1 = inspectUuid("{C232AB00-9414-11EC-B3C8-9E6BDECED846}");
    expect(v1).toMatchObject({ version: 1, canonical: "c232ab00-9414-11ec-b3c8-9e6bdeced846" });
    expect(v1?.timestamp?.toISOString()).toBe("2022-02-22T19:22:22.000Z");
    expect(inspectUuid("00000000-0000-0000-0000-000000000000")?.special).toBe("nil");
    expect(inspectUuid("ffffffff-ffff-ffff-ffff-ffffffffffff")?.special).toBe("max");
  });

  it("rejects invalid UUIDs", () => {
    expect(inspectUuid("not-a-uuid")).toBeNull();
    expect(inspectUuid("0190a5b8-6e1f-7c3a-9b2d-4e5f6a7b8c9")).toBeNull();
  });
});

describe("Bcrypt", () => {
  it("hashes and verifies", async () => {
    const r = await bcryptHash("hunter2", 4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(parseBcrypt(r.hash)).toMatchObject({ version: "2b", cost: 4 });
    expect(await bcryptCompare("hunter2", r.hash)).toEqual({ ok: true, match: true });
    expect(await bcryptCompare("hunter3", r.hash)).toEqual({ ok: true, match: false });
  }, 20_000);

  it("verifies a known $2a$ hash", async () => {
    // "password" with cost 10, generated by a reference implementation.
    const hash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    expect(parseBcrypt(hash)).toMatchObject({ version: "2a", cost: 10, salt: "N9qo8uLOickgx2ZMRZoMye" });
  });

  it("validates cost, password length and hash format", async () => {
    expect(await bcryptHash("x", 3)).toEqual({ ok: false, error: "cost" });
    expect(await bcryptHash("x", 16)).toEqual({ ok: false, error: "cost" });
    expect(exceedsBcryptLimit("ñ".repeat(37))).toBe(true);
    expect(await bcryptHash("a".repeat(73), 4)).toEqual({ ok: false, error: "length" });
    expect(await bcryptCompare("x", "$2b$10$short")).toEqual({ ok: false, error: "hash" });
    expect(parseBcrypt("$2b$03$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy")).toBeNull();
  });
});

describe("Password generator", () => {
  const base = { length: 20, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: false };

  it("uses every selected set and the requested length", () => {
    for (let i = 0; i < 50; i++) {
      const r = generatePassword(base);
      if (!r.ok) throw new Error();
      expect(r.password).toHaveLength(20);
      expect(r.password).toMatch(/[a-z]/);
      expect(r.password).toMatch(/[A-Z]/);
      expect(r.password).toMatch(/\d/);
      expect(r.password).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("can exclude ambiguous characters", () => {
    const sets = activeSets({ ...base, excludeAmbiguous: true }).join("");
    for (const c of "0Oo1lI") expect(sets).not.toContain(c);
    const r = generatePassword({ ...base, length: 200, excludeAmbiguous: true });
    expect(r.ok && /[0Oo1lI|]/.test(r.password)).toBe(false);
  });

  it("computes entropy and strength", () => {
    expect(entropyBits(16, 94)).toBe(105);
    expect(strength(40)).toBe("weak");
    expect(strength(70)).toBe("fair");
    expect(strength(100)).toBe("strong");
    expect(strength(200)).toBe("very-strong");
  });

  it("is roughly uniform", () => {
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 6000; i++) counts[randomInt(6)]++;
    for (const c of counts) expect(c).toBeGreaterThan(800);
  });

  it("generates secrets of the right size", () => {
    expect(generateSecret(32, "hex")).toMatch(/^[0-9a-f]{64}$/);
    expect(generateSecret(32, "base64url")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateSecret(32, "base64")).toHaveLength(44);
  });

  it("validates options", () => {
    expect(generatePassword({ ...base, lower: false, upper: false, digits: false, symbols: false })).toEqual({
      ok: false,
      error: "sets",
    });
    expect(generatePassword({ ...base, length: 3 })).toEqual({ ok: false, error: "length" });
    expect(generatePassword({ ...base, length: 1000 })).toEqual({ ok: false, error: "length" });
  });
});

describe("RSA / EC keys", () => {
  it.each([
    { type: "RSA" as const, rsaSize: 2048 as const },
    { type: "EC" as const, curve: "P-384" as const },
    { type: "Ed25519" as const },
  ])(
    "generates $type keys and converts PEM ↔ JWK",
    async (o) => {
      const pair = await generateKeyPairPem(o);
      expect(pair.privatePem).toContain("BEGIN PRIVATE KEY");
      expect(pair.publicPem).toContain("BEGIN PUBLIC KEY");
      expect(pair.privateJwk.d).toBeDefined();
      expect(pair.publicJwk.d).toBeUndefined();

      const pub = await pemToJwk(pair.publicPem);
      expect(pub.ok && pub.kind).toBe("public");
      if (!pub.ok) return;
      const back = await jwkToPem(pub.output);
      expect(back).toEqual({ ok: true, output: pair.publicPem, kind: "public" });

      const priv = await jwkToPem(JSON.stringify(pair.privateJwk));
      expect(priv.ok && priv.kind).toBe("private");
    },
    30_000,
  );

  it("rejects things that are not keys", async () => {
    expect(await pemToJwk("hello")).toEqual({ ok: false, error: "format" });
    expect(await pemToJwk("-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----")).toEqual({
      ok: false,
      error: "key",
    });
    expect(await jwkToPem("{oops")).toEqual({ ok: false, error: "format" });
    expect(await jwkToPem('{"kty":"oct","k":"abc"}')).toEqual({ ok: false, error: "key" });
  });
});

describe("X.509 certificates", () => {
  x509.cryptoProvider.set(webcrypto as unknown as Crypto);

  async function makeCert(notBefore: Date, notAfter: Date) {
    const alg = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
    const keys = await webcrypto.subtle.generateKey(alg, true, ["sign", "verify"]);
    const cert = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber: "01ab",
      name: "CN=kitforweb.test, O=kitforweb",
      notBefore,
      notAfter,
      signingAlgorithm: alg,
      keys: keys as CryptoKeyPair,
      extensions: [
        new x509.SubjectAlternativeNameExtension([
          { type: "dns", value: "kitforweb.test" },
          { type: "dns", value: "*.kitforweb.test" },
          { type: "ip", value: "127.0.0.1" },
        ]),
        new x509.BasicConstraintsExtension(false),
        new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyEncipherment),
      ],
    });
    return cert.toString("pem");
  }

  const now = new Date("2026-01-01T00:00:00Z");

  it("extracts subject, SANs, validity, algorithm and fingerprints", async () => {
    const pem = await makeCert(new Date("2025-06-01T00:00:00Z"), new Date("2026-03-01T00:00:00Z"));
    const r = await parseCertificates(pem, now);
    if (!r.ok) throw new Error(r.error);
    const [c] = r.certs;
    expect(c.commonName).toBe("kitforweb.test");
    expect(c.selfSigned).toBe(true);
    expect(c.dnsNames).toEqual(["kitforweb.test", "*.kitforweb.test"]);
    expect(c.ipAddresses).toEqual(["127.0.0.1"]);
    expect(c.status).toBe("valid");
    expect(c.daysLeft).toBe(59);
    expect(c.publicKeyAlgorithm).toContain("ECDSA");
    expect(c.isCA).toBe(false);
    expect(c.keyUsages).toEqual(expect.arrayContaining(["digitalSignature", "keyEncipherment"]));
    expect(c.sha256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    expect(c.serialNumber).toBe("01AB");
  }, 20_000);

  it("flags expired certificates and parses chains", async () => {
    const expired = await makeCert(new Date("2024-01-01T00:00:00Z"), new Date("2025-01-01T00:00:00Z"));
    const valid = await makeCert(new Date("2025-01-01T00:00:00Z"), new Date("2027-01-01T00:00:00Z"));
    const r = await parseCertificates(`${valid}\n${expired}`, now);
    expect(r.ok && r.certs.map((c) => c.status)).toEqual(["valid", "expired"]);
    expect(splitPem(`junk ${valid} more`)).toHaveLength(1);
  }, 20_000);

  it("reports missing and corrupt certificates", async () => {
    expect(await parseCertificates("hello")).toEqual({ ok: false, error: "none" });
    expect(await parseCertificates("-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----")).toEqual({
      ok: false,
      error: "invalid",
      index: 1,
    });
  });
});
