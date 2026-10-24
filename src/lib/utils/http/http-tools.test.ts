import { describe, expect, it } from "vitest";
import { tokenize } from "../shell/tokenize";
import { parseCurl, toAngular, toAxios, toFetch } from "./curl";
import { analyzeHeaders, parseHeaders } from "./headers";
import { breadcrumbUrl, generateMetaTags, lengthStatus, truncate, type MetaInput } from "./meta";
import { bump, checkRange, sortVersions, versionDiff } from "./semver";
import { findStatus, statusClass, statusCodes } from "./status";
import { parseUserAgent } from "./user-agent";

describe("cURL tokenizer", () => {
  it("handles quotes, escapes and line continuations", () => {
    expect(tokenize(`curl 'https://a.com' \\\n  -H "X-A: \\"q\\"" --data-raw $'{"a":"b\\nc"}'`)).toEqual([
      "curl",
      "https://a.com",
      "-H",
      'X-A: "q"',
      "--data-raw",
      '{"a":"b\nc"}',
    ]);
    expect(tokenize('curl ^"https://a.com^" ^\n  -H ^"Accept: */*^"')).toEqual([
      "curl",
      "https://a.com",
      "-H",
      "Accept: */*",
    ]);
    expect(tokenize("curl 'unterminated")).toBeNull();
  });
});

describe("cURL parser", () => {
  const devtools = `curl 'https://api.example.com/v1/users?page=2' \\
  -H 'accept: application/json' \\
  -H 'authorization: Bearer abc123' \\
  -H 'content-type: application/json' \\
  --data-raw '{"name":"Ada","admin":true}' \\
  --compressed`;

  it("reads method, URL, headers and JSON body", () => {
    const r = parseCurl(devtools);
    if (!r.ok) throw new Error(r.error);
    expect(r.curl).toMatchObject({
      url: "https://api.example.com/v1/users?page=2",
      method: "POST",
      body: '{"name":"Ada","admin":true}',
    });
    expect(r.curl.headers).toContainEqual(["authorization", "Bearer abc123"]);
  });

  it("supports -X, -u, -b, -A, --json, -G and attached values", () => {
    const r = parseCurl(`curl -XPUT -u ada:secret -b 'sid=1' -A UA --json '{"a":1}' https://a.com/x`);
    if (!r.ok) throw new Error();
    expect(r.curl.method).toBe("PUT");
    expect(r.curl.auth).toEqual({ user: "ada", password: "secret" });
    expect(r.curl.headers).toEqual(
      expect.arrayContaining([
        ["Cookie", "sid=1"],
        ["User-Agent", "UA"],
        ["Content-Type", "application/json"],
      ]),
    );
    const g = parseCurl("curl -G https://a.com/search -d q=café -d page=2");
    expect(g.ok && g.curl.url).toBe("https://a.com/search?q=caf%C3%A9&page=2");
    expect(g.ok && g.curl.method).toBe("GET");
  });

  it("handles forms and form-encoded data", () => {
    const f = parseCurl("curl -F 'file=@photo.jpg' -F name=Ada https://a.com/upload");
    expect(f.ok && f.curl.form).toEqual([
      ["file", "@photo.jpg"],
      ["name", "Ada"],
    ]);
    expect(f.ok && f.curl.method).toBe("POST");
    const d = parseCurl("curl https://a.com -d a=1 -d b=2");
    expect(d.ok && d.curl.body).toBe("a=1&b=2");
    expect(d.ok && d.curl.headers).toContainEqual(["Content-Type", "application/x-www-form-urlencoded"]);
  });

  it("rejects non-curl input and missing URLs", () => {
    expect(parseCurl("wget https://a.com")).toEqual({ ok: false, error: "not-curl" });
    expect(parseCurl("curl -H 'a: b'")).toEqual({ ok: false, error: "no-url" });
    expect(parseCurl("curl 'oops")).toEqual({ ok: false, error: "quotes" });
  });

  it("generates fetch, axios and Angular code", () => {
    const r = parseCurl(devtools);
    if (!r.ok) throw new Error();
    const f = toFetch(r.curl);
    expect(f).toContain('await fetch("https://api.example.com/v1/users?page=2", {');
    expect(f).toContain('method: "POST",');
    expect(f).toContain('authorization: "Bearer abc123",');
    expect(f).toContain('"name": "Ada"');
    expect(f).toContain("await response.json()");
    expect(toAxios(r.curl)).toContain('method: "post",');
    expect(toAngular(r.curl)).toContain('http.post("https://api.example.com/v1/users?page=2", {');
    const form = parseCurl("curl -F a=1 https://a.com");
    expect(form.ok && toFetch(form.curl)).toContain("body: form,");
  });
});

describe("HTTP status codes", () => {
  it("knows every class and common code", () => {
    expect(statusClass(204)).toBe("success");
    expect(statusClass(418)).toBe("client");
    expect(statusClass(99)).toBeNull();
    expect(findStatus(429)?.name).toBe("Too Many Requests");
    expect(new Set(statusCodes.map((s) => s.code)).size).toBe(statusCodes.length);
  });
});

describe("HTTP headers analyser", () => {
  const raw = `HTTP/2 200
content-type: text/html; charset=utf-8
server: nginx/1.25.3
set-cookie: session=abc; Path=/
access-control-allow-origin: *
access-control-allow-credentials: true
x-frame-options: DENY
cache-control: max-age=3600`;

  it("parses the status line and headers", () => {
    const { status, headers } = parseHeaders(raw);
    expect(status).toEqual({ version: "HTTP/2", code: 200, text: "" });
    expect(headers.find((h) => h.key === "cache-control")).toMatchObject({ value: "max-age=3600", category: "cache" });
  });

  it("flags missing security headers and risky configurations", () => {
    const ids = analyzeHeaders(raw).issues.map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "missing-csp",
        "missing-hsts",
        "missing-nosniff",
        "cors-wildcard-credentials",
        "cookie-not-secure",
        "cookie-not-httponly",
        "cookie-no-samesite",
        "version-disclosure",
      ]),
    );
    expect(ids).not.toContain("missing-frame-protection");
    expect(ids).not.toContain("no-cache-policy");
  });

  it("is quiet for a well-configured response", () => {
    const good = analyzeHeaders(`HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self'; frame-ancestors 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Cache-Control: no-store
Set-Cookie: id=1; Secure; HttpOnly; SameSite=Lax`);
    expect(good.issues).toEqual([]);
  });

  it("joins folded lines and ignores garbage", () => {
    const { headers } = parseHeaders("X-Long: a\n  b\nnot a header\n: empty");
    expect(headers).toEqual([{ name: "X-Long", value: "a b", key: "x-long", category: null }]);
  });
});

describe("Meta tags", () => {
  const input: MetaInput = {
    title: 'Tom & "Jerry"',
    description: "A description",
    url: "https://www.example.com/blog/post",
    image: "https://example.com/og.png",
    siteName: "Example",
    type: "article",
    twitterSite: "@example",
    locale: "es_ES",
  };

  it("generates escaped title, OG and Twitter tags", () => {
    const html = generateMetaTags(input);
    expect(html).toContain("<title>Tom &amp; &quot;Jerry&quot;</title>");
    expect(html).toContain('<meta property="og:type" content="article" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain('<meta name="twitter:site" content="@example" />');
    expect(generateMetaTags({ ...input, image: "" })).toContain('content="summary"');
  });

  it("checks lengths and truncates at word boundaries", () => {
    expect(lengthStatus("", 60)).toBe("empty");
    expect(lengthStatus("short", 60)).toBe("short");
    expect(lengthStatus("x".repeat(61), 60)).toBe("long");
    expect(lengthStatus("A good title for a page", 60)).toBe("ok");
    expect(truncate("The quick brown fox jumps over the lazy dog", 20)).toBe("The quick brown fox…");
    expect(truncate("short", 20)).toBe("short");
  });

  it("builds Google-style breadcrumbs", () => {
    expect(breadcrumbUrl("https://www.example.com/blog/post")).toBe("example.com › blog › post");
    expect(breadcrumbUrl("not a url")).toBe("not a url");
  });
});

describe("User-Agent", () => {
  it("parses a desktop Chrome on Windows", () => {
    const r = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    expect(r).toMatchObject({
      browser: { name: "Chrome", major: "124" },
      engine: { name: "Blink" },
      os: { name: "Windows" },
      device: { type: "desktop" },
    });
    expect(r.bot).toBeUndefined();
  });

  it("parses an iPhone and recognises bots", () => {
    const iphone = parseUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    );
    expect(iphone).toMatchObject({
      browser: { name: "Mobile Safari" },
      os: { name: "iOS", version: "17.4" },
      device: { type: "mobile", model: "iPhone" },
    });
    expect(parseUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)").bot).toBe(
      "Googlebot",
    );
    expect(parseUserAgent("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0)").bot).toBe(
      "ClaudeBot (Anthropic)",
    );
    expect(parseUserAgent("curl/8.4.0").bot).toBe("curl");
  });
});

describe("Semver", () => {
  it("checks ranges and expands them", () => {
    expect(checkRange("1.4.0", "^1.2.3")).toMatchObject({
      ok: true,
      satisfies: true,
      comparators: [[">=1.2.3", "<2.0.0-0"]],
      min: "1.2.3",
    });
    expect(checkRange("2.0.0", "^1.2.3")).toMatchObject({ ok: true, satisfies: false });
    expect(checkRange("1.2.9", "~1.2.3")).toMatchObject({ satisfies: true });
    expect(checkRange("1.3.0", "~1.2.3")).toMatchObject({ satisfies: false });
    expect(checkRange("0.2.5", "^0.2.3")).toMatchObject({ satisfies: true, comparators: [[">=0.2.3", "<0.3.0-0"]] });
    expect(checkRange("1.5.0", ">=1.0.0 <2.0.0 || 3.x")).toMatchObject({
      satisfies: true,
      comparators: [
        [">=1.0.0", "<2.0.0"],
        [">=3.0.0", "<4.0.0-0"],
      ],
    });
  });

  it("handles prereleases and coerces loose versions", () => {
    expect(checkRange("1.3.0-beta.1", "^1.2.0")).toMatchObject({ satisfies: false });
    expect(checkRange("1.3.0-beta.1", "^1.2.0", true)).toMatchObject({ satisfies: true });
    expect(checkRange("v1.4", "^1.2.0")).toMatchObject({ satisfies: true });
  });

  it("rejects invalid input", () => {
    expect(checkRange("1.0.0", "not a range!!")).toEqual({ ok: false, error: "range" });
    expect(checkRange("banana", "^1.0.0")).toEqual({ ok: false, error: "version" });
  });

  it("sorts versions semantically and diffs them", () => {
    expect(sortVersions(["1.10.0", "1.2.0", "v1.9.0", "1.2.0-beta", "nope"])).toEqual({
      ok: true,
      sorted: ["1.2.0-beta", "1.2.0", "1.9.0", "1.10.0"],
      invalid: ["nope"],
    });
    expect(sortVersions(["1.0.0", "2.0.0"], true).sorted).toEqual(["2.0.0", "1.0.0"]);
    expect(versionDiff("1.2.3", "2.0.0")).toBe("major");
    expect(versionDiff("1.2.3", "1.2.4")).toBe("patch");
    expect(versionDiff("1.2.3", "x")).toBe("invalid");
    expect(bump("1.2.3", "minor")).toBe("1.3.0");
    expect(bump("1.2.3", "prerelease")).toBe("1.2.4-beta.0");
  });
});
