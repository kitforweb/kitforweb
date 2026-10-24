import { describe, expect, it } from "vitest";
import { verifyJwt } from "../jwt/verify";
import { decodeJwt } from "../jwt/decode";
import { generateDemoKeys, signJwt } from "../jwt/sign";
import { bytesToBase64, cleanBase64, decodeBase64, encodeBase64, sniffMime } from "./base64";
import { decodeEntities, encodeEntities } from "./entities";
import { compressText, decompressBase64, detectFormat } from "./gzip";
import { convertDomain, convertLines } from "./punycode";
import { bytesToText, formatInteger, parseInteger, textToBytes } from "./radix";
import { analyzeText, describeChar, escapeForJs, stripInvisible, unescapeJs } from "./unicode";
import { urlDecode, urlEncodeAll } from "./url-encode";
import { buildUrl, classifyValue, parseUrl } from "./url-params";

describe("JWT generator", () => {
  const now = 1_700_000_000;

  it("signs HS256 tokens that verify, adding iat and exp", async () => {
    const r = await signJwt(
      { alg: "HS256", payload: '{"sub":"42"}', key: "s3cret", issuedAt: true, expiresIn: 3600 },
      now,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = decodeJwt(r.token);
    expect(d.ok && d.jwt.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(d.ok && d.jwt.payload).toEqual({ sub: "42", iat: now, exp: now + 3600 });
    expect(await verifyJwt(r.token, "HS256", "s3cret")).toEqual({ ok: true });
  });

  it("keeps iat/exp already present in the payload", async () => {
    const r = await signJwt(
      { alg: "HS256", payload: '{"iat":1,"exp":2}', key: "k", issuedAt: true, expiresIn: 60 },
      now,
    );
    const d = r.ok ? decodeJwt(r.token) : null;
    expect(d?.ok && d.jwt.payload).toEqual({ iat: 1, exp: 2 });
  });

  it.each(["RS256", "PS256", "ES256", "EdDSA"] as const)("signs %s with a generated PKCS#8 key", async (alg) => {
    const keys = await generateDemoKeys(alg);
    expect(keys.privateKey).toContain("BEGIN PRIVATE KEY");
    const r = await signJwt({ alg, payload: '{"a":1}', key: keys.privateKey, kid: "k1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await verifyJwt(r.token, alg, keys.publicKey)).toEqual({ ok: true });
    const d = decodeJwt(r.token);
    expect(d.ok && d.jwt.header.kid).toBe("k1");
  });

  it("generates HMAC secrets of the right length", async () => {
    const keys = await generateDemoKeys("HS512");
    expect(keys.publicKey).toBe("");
    expect(keys.privateKey).toMatch(/^[A-Za-z0-9_-]{86}$/); // 64 bytes in Base64URL
  });

  it("reports invalid payloads, keys and empty secrets", async () => {
    expect(await signJwt({ alg: "HS256", payload: "[1]", key: "k" })).toEqual({ ok: false, error: "payload" });
    expect(await signJwt({ alg: "HS256", payload: "{oops", key: "k" })).toEqual({ ok: false, error: "payload" });
    expect(await signJwt({ alg: "HS256", payload: "{}", key: "" })).toEqual({ ok: false, error: "secret" });
    expect(await signJwt({ alg: "RS256", payload: "{}", key: "not a key" })).toEqual({ ok: false, error: "key" });
  });
});

describe("URL parameters", () => {
  const url =
    "https://shop.example.com/search?q=caf%C3%A9+con+leche&tag=a&tag=b&filter=%7B%22price%22%3A10%7D&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb%3Fstate%3Dxyz#access_token=abc&expires_in=3600";

  it("decodes parameters, keeps repeated keys and parses the fragment", () => {
    const r = parseUrl(url);
    if (!("url" in r)) throw new Error();
    const { params, hashParams, host, pathname } = r.url;
    expect(host).toBe("shop.example.com");
    expect(pathname).toBe("/search");
    expect(params[0]).toMatchObject({ key: "q", value: "café con leche", kind: null });
    expect(params.filter((p) => p.key === "tag").map((p) => p.occurrence)).toEqual([0, 1]);
    expect(params.find((p) => p.key === "filter")).toMatchObject({ kind: "json" });
    const redirect = params.find((p) => p.key === "redirect_uri");
    expect(redirect?.kind).toBe("url");
    expect(redirect?.nested?.params).toEqual([expect.objectContaining({ key: "state", value: "xyz" })]);
    expect(hashParams.map((p) => p.key)).toEqual(["access_token", "expires_in"]);
  });

  it("detects JWT and Base64 values", () => {
    expect(classifyValue("eyJhbGciOiJIUzI1NiJ9.e30.abc").kind).toBe("jwt");
    expect(classifyValue("aGVsbG8gd29ybGQgZnJvbSBrZncK")).toEqual({
      kind: "base64",
      preview: "hello world from kfw\n",
    });
    expect(classifyValue("plain").kind).toBeNull();
  });

  it("accepts URLs without scheme and keeps non-parameter fragments", () => {
    const r = parseUrl("example.com/a#/route/1");
    expect("url" in r && r.url).toMatchObject({ protocol: "https", hash: "/route/1", hashParams: [] });
  });

  it("rebuilds the URL with edited values", () => {
    expect(
      buildUrl("https://a.com/p?x=1", [
        { key: "q", value: "a b&c" },
        { key: "q", value: "2" },
      ]),
    ).toBe("https://a.com/p?q=a+b%26c&q=2");
  });

  it("rejects empty and invalid input", () => {
    expect(parseUrl("  ")).toEqual({ error: "empty" });
    expect(parseUrl("http://exa mple.com")).toEqual({ error: "invalid" });
  });
});

describe("Base64", () => {
  it("encodes UTF-8 text in Base64 and Base64URL", () => {
    expect(encodeBase64("¿qué? 😀")).toBe("wr9xdcOpPyDwn5iA");
    expect(encodeBase64("??>>", true)).toBe("Pz8-Pg");
  });

  it("decodes Base64, Base64URL and data URLs", () => {
    expect(decodeBase64("wr9xdcOpPyDwn5iA")).toMatchObject({ ok: true, text: "¿qué? 😀" });
    expect(decodeBase64("Pz8-Pg")).toMatchObject({ ok: true, text: "??>>" });
    expect(decodeBase64("data:text/plain;base64,aG9sYQ==")).toMatchObject({
      ok: true,
      text: "hola",
      mime: "text/plain",
    });
    expect(cleanBase64("aG9s\n YQ==")).toEqual({ data: "aG9sYQ==" });
  });

  it("recognises binary content", () => {
    const png = bytesToBase64(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]));
    expect(decodeBase64(png)).toMatchObject({ ok: true, text: null, mime: "image/png" });
    expect(sniffMime(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("image/svg+xml");
  });

  it("handles large inputs and the empty string", () => {
    const big = new Uint8Array(200_000).fill(65);
    expect(bytesToBase64(big).length).toBe(266_668);
    expect(encodeBase64("")).toBe("");
  });

  it("rejects invalid alphabets and lengths", () => {
    expect(decodeBase64("abc$")).toEqual({ ok: false, error: "alphabet" });
    expect(decodeBase64("abcde")).toEqual({ ok: false, error: "length" });
  });
});

describe("URL encode", () => {
  it("shows the three encodings", () => {
    expect(urlEncodeAll("a b&c/ñ?")).toEqual({
      component: "a%20b%26c%2F%C3%B1%3F",
      uri: "a%20b&c/%C3%B1?",
      form: "a+b%26c%2F%C3%B1%3F",
    });
  });

  it("decodes, optionally reading + as a space", () => {
    expect(urlDecode("caf%C3%A9+con%20leche")).toEqual({ ok: true, output: "café+con leche" });
    expect(urlDecode("caf%C3%A9+con", true)).toEqual({ ok: true, output: "café con" });
  });

  it("locates malformed sequences", () => {
    expect(urlDecode("100%")).toMatchObject({ ok: false, column: 4 });
    expect(urlDecode("ok%E0%A4%A")).toMatchObject({ ok: false });
  });
});

describe("HTML entities", () => {
  it("encodes only the special characters by default", () => {
    expect(encodeEntities(`<a href="x">Tom & Jerry's café</a>`, { style: "named", nonAscii: false })).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s café&lt;/a&gt;",
    );
    expect(encodeEntities("<&", { style: "decimal", nonAscii: false })).toBe("&#60;&#38;");
    expect(encodeEntities("<&", { style: "hex", nonAscii: false })).toBe("&#x3C;&#x26;");
  });

  it("can encode every non-ASCII character", () => {
    expect(encodeEntities("é😀", { style: "named", nonAscii: true })).toBe("&eacute;&#x1F600;");
    expect(encodeEntities("é", { style: "decimal", nonAscii: true })).toBe("&#233;");
  });

  it("decodes named, decimal and hex entities", () => {
    expect(decodeEntities("&lt;p&gt;caf&eacute; &#233; &#xE9; &nbsp;&amp;amp;")).toBe("<p>café é é \u00A0&amp;");
    expect(decodeEntities("no entities")).toBe("no entities");
  });
});

describe("Unicode inspector", () => {
  it("describes code points with every escape", () => {
    expect(describeChar("é")).toMatchObject({
      label: "U+00E9",
      utf8: "C3 A9",
      js: "\\u00E9",
      html: "&#xE9;",
      css: "\\E9",
      category: "letter",
    });
    expect(describeChar("😀")).toMatchObject({
      label: "U+1F600",
      utf8: "F0 9F 98 80",
      utf16: "D83D DE00",
      js: "\\u{1F600}",
    });
  });

  it("flags invisible characters", () => {
    const chars = analyzeText("a\u200Bb\uFEFF c");
    expect(chars.filter((c) => c.invisible).map((c) => c.name)).toEqual([
      "ZERO WIDTH SPACE",
      "ZERO WIDTH NO-BREAK SPACE (BOM)",
    ]);
    expect(describeChar(" ").invisible).toBe(false);
    expect(describeChar("\u00A0").invisible).toBe(true);
  });

  it("counts code points, not UTF-16 units", () => {
    expect(analyzeText("👍🏽")).toHaveLength(2);
  });

  it("strips invisible characters and escapes for JS", () => {
    expect(stripInvisible("pass\u200Bword\u202E")).toBe("password");
    expect(escapeForJs("café 😀")).toBe("caf\\u00E9 \\u{1F600}");
    expect(unescapeJs("caf\\u00e9 \\u{1F600} \\x41")).toBe("café 😀 A");
  });
});

describe("Hex ↔ binary", () => {
  it("parses numbers in any base, with prefixes", () => {
    expect(parseInteger("0xFF")).toEqual({ ok: true, value: BigInt(255), radix: 16 });
    expect(parseInteger("0b1010")).toEqual({ ok: true, value: BigInt(10), radix: 2 });
    expect(parseInteger("ff", 16)).toEqual({ ok: true, value: BigInt(255), radix: 16 });
    expect(parseInteger("-1_000")).toEqual({ ok: true, value: BigInt(-1000), radix: 10 });
  });

  it("handles numbers beyond Number.MAX_SAFE_INTEGER", () => {
    const r = parseInteger("18446744073709551615");
    expect(r.ok && formatInteger(r.value, 16)).toBe("FFFFFFFFFFFFFFFF");
  });

  it("formats and groups digits", () => {
    expect(formatInteger(BigInt(10), 2, true)).toBe("1010");
    expect(formatInteger(BigInt(300), 2, true)).toBe("0001 0010 1100");
    expect(formatInteger(BigInt(-255), 16)).toBe("-FF");
    expect(formatInteger(BigInt(8), 8)).toBe("10");
  });

  it("rejects invalid digits", () => {
    expect(parseInteger("12a")).toEqual({ ok: false, error: "digits" });
    expect(parseInteger("102", 2)).toEqual({ ok: false, error: "digits" });
    expect(parseInteger("0x")).toEqual({ ok: false, error: "digits" });
    expect(parseInteger("")).toEqual({ ok: false, error: "empty" });
  });

  it("converts text to bytes and back", () => {
    expect(textToBytes("Hé", "hex")).toBe("48 c3 a9");
    expect(textToBytes("Hi", "binary")).toBe("01001000 01101001");
    expect(textToBytes("Hi", "decimal")).toBe("72 105");
    expect(bytesToText("48 c3 a9", "hex")).toEqual({ ok: true, text: "Hé" });
    expect(bytesToText("0x48656c6c6f", "hex")).toEqual({ ok: true, text: "Hello" });
    expect(bytesToText("01001000 01101001", "binary")).toEqual({ ok: true, text: "Hi" });
  });

  it("rejects invalid bytes and UTF-8", () => {
    expect(bytesToText("zz", "hex")).toEqual({ ok: false, error: "digits" });
    expect(bytesToText("256", "decimal")).toEqual({ ok: false, error: "digits" });
    expect(bytesToText("c3", "hex")).toEqual({ ok: false, error: "utf8" });
  });
});

describe("Punycode", () => {
  it("converts domains both ways", () => {
    expect(convertDomain("españa.com", true)).toEqual({ ok: true, output: "xn--espaa-rta.com" });
    expect(convertDomain("xn--mnchen-3ya.de", false)).toEqual({ ok: true, output: "münchen.de" });
    expect(convertDomain("例え.テスト", true)).toEqual({ ok: true, output: "xn--r8jz45g.xn--zckzah" });
  });

  it("only touches the host of URLs and emails", () => {
    expect(convertDomain("https://bücher.de/straße?q=ä", true)).toEqual({
      ok: true,
      output: "https://xn--bcher-kva.de/straße?q=ä",
    });
    expect(convertDomain("josé@correo.es", true)).toEqual({ ok: true, output: "josé@correo.es" });
    expect(convertDomain("info@niño.com", true)).toEqual({ ok: true, output: "info@xn--nio-8ma.com" });
  });

  it("leaves ASCII domains alone and reports errors per line", () => {
    expect(convertDomain("example.com", true)).toEqual({ ok: true, output: "example.com" });
    expect(convertDomain("two words", true)).toEqual({ ok: false, error: "spaces" });
    expect(convertLines("ñ.com\n\nbad domain", true)).toEqual({ output: "xn--ida.com\n\nbad domain", errors: [3] });
  });
});

describe("Gzip", () => {
  const text = "kitforweb ".repeat(50);

  it.each(["gzip", "deflate", "deflate-raw"] as const)("round-trips with %s", async (format) => {
    const c = await compressText(text, format);
    expect(c.outputBytes).toBeLessThan(c.inputBytes);
    const d = await decompressBase64(c.base64, format);
    expect(d).toMatchObject({ ok: true, text, format });
  });

  it("auto-detects the format from the magic bytes", async () => {
    const gz = await compressText("hola", "gzip");
    expect(gz.base64.startsWith("H4sI")).toBe(true);
    expect(await decompressBase64(gz.base64)).toMatchObject({ ok: true, text: "hola", format: "gzip" });
    const z = await compressText("hola", "deflate");
    expect(await decompressBase64(z.base64)).toMatchObject({ ok: true, format: "deflate" });
    expect(detectFormat(new Uint8Array([1, 2]))).toBe("deflate-raw");
  });

  it("reports invalid Base64 and corrupt data", async () => {
    expect(await decompressBase64("abcde")).toEqual({ ok: false, error: "base64" });
    expect(await decompressBase64("H4sIAAAAAAAAA8vIzMlXAAAA")).toMatchObject({ ok: false });
  });
});
