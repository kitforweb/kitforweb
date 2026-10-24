import { base64UrlToText } from "../encoding/base64url";
import { parseBezier } from "../css/bezier";
import { parseGradient } from "../css/gradient";
import { parseBoxShadow } from "../css/shadow";
import { parseIp } from "../infra/cidr";
import { detectCase } from "../text/case-style";
import { isTimeZone } from "../time/zones";

/** Every kind of data the smart detector can recognise. */
export const dataKinds = [
  "curl",
  "docker-run",
  "jwt",
  "pem",
  "url",
  "http-headers",
  "timestamp",
  "iso-date",
  "uuid",
  "color",
  "cron",
  "mermaid",
  "sql",
  "xml",
  "json",
  "html",
  "yaml",
  "csv",
  "env",
  "url-encoded",
  "html-entities",
  "base64",
  "gzip",
  "idn",
  "radix",
  "invisible-chars",
  "pem-key",
  "bcrypt",
  "jwk",
  "regex",
  "timezone",
  "user-agent",
  "semver",
  "http-status",
  "sql-ddl",
  "openapi",
  "json-schema",
  "cidr",
  "chmod",
  "markdown",
  "identifier",
  "css-length",
  "box-shadow",
  "gradient",
  "cubic-bezier",
  "svg",
  "qr-payload",
] as const;
export type DataKind = (typeof dataKinds)[number];

export interface KindDetection {
  kind: DataKind;
  confidence: number; // 0..1
}

export type KindDetector = (input: string) => KindDetection | null;

const hit = (kind: DataKind, confidence: number): KindDetection => ({ kind, confidence });

const nonEmptyLines = (input: string) =>
  input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");

export const detectCurl: KindDetector = (input) => (/^\s*curl(\.exe)?\s+/i.test(input) ? hit("curl", 0.98) : null);

export const detectDockerRun: KindDetector = (input) =>
  /^\s*(sudo\s+)?docker\s+(container\s+)?run\s/i.test(input) ? hit("docker-run", 0.98) : null;

const B64URL_PART = /^[A-Za-z0-9_-]+$/;

export const detectJwt: KindDetector = (input) => {
  const parts = input
    .trim()
    .replace(/^bearer\s+/i, "")
    .split(".");
  if (parts.length !== 3) return null;
  if (!B64URL_PART.test(parts[0]) || !B64URL_PART.test(parts[1])) return null;
  if (parts[2] !== "" && !B64URL_PART.test(parts[2])) return null;
  try {
    // base64UrlToText restores the `=` padding that atob needs.
    const header: unknown = JSON.parse(base64UrlToText(parts[0]));
    return typeof header === "object" && header !== null && "alg" in header ? hit("jwt", 0.95) : null;
  } catch {
    return null;
  }
};

/** PEM blocks: certificates ("pem") and keys ("pem-key") open different tools. */
export const detectPem: KindDetector = (input) => {
  const m = /-----BEGIN ([A-Z0-9 ]+)-----[\s\S]+-----END [A-Z0-9 ]+-----/.exec(input);
  if (!m) return null;
  return /KEY/.test(m[1]) ? hit("pem-key", 0.97) : hit("pem", 0.97);
};

export const detectBcrypt: KindDetector = (input) =>
  /^\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(input.trim()) ? hit("bcrypt", 0.98) : null;

/** JSON Web Key: an object with "kty", or a JWKS with "keys". */
export const detectJwk: KindDetector = (input) => {
  const text = input.trim();
  if (!text.startsWith("{") || !text.includes('"kty"')) return null;
  try {
    const v = JSON.parse(text) as { kty?: unknown; keys?: unknown };
    return typeof v.kty === "string" ? hit("jwk", 0.97) : null;
  } catch {
    return null;
  }
};

export const detectUrl: KindDetector = (input) => {
  const text = input.trim();
  if (/\s/.test(text) || !/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return null;
  try {
    const url = new URL(text);
    return ["http:", "https:", "ws:", "wss:", "ftp:"].includes(url.protocol) ? hit("url", 0.9) : null;
  } catch {
    return null;
  }
};

const HEADER_LINE = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+:\s*\S.*$/;

const KNOWN_HEADERS = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "access-control-allow-origin",
  "age",
  "authorization",
  "cache-control",
  "connection",
  "content-encoding",
  "content-length",
  "content-security-policy",
  "content-type",
  "cookie",
  "date",
  "etag",
  "expires",
  "host",
  "last-modified",
  "location",
  "origin",
  "pragma",
  "referer",
  "referrer-policy",
  "server",
  "set-cookie",
  "strict-transport-security",
  "transfer-encoding",
  "user-agent",
  "vary",
  "via",
  "www-authenticate",
]);

export const detectHttpHeaders: KindDetector = (input) => {
  const lines = nonEmptyLines(input);
  if (lines.length === 0) return null;
  const statusLine = /^HTTP\/\d(\.\d)?\s+\d{3}/i.test(lines[0]);
  const headerLines = (statusLine ? lines.slice(1) : lines).filter((l) => HEADER_LINE.test(l));
  const total = statusLine ? lines.length - 1 : lines.length;
  if (statusLine && headerLines.length >= 1) return hit("http-headers", 0.95);
  if (headerLines.length >= 2 && headerLines.length / total >= 0.8 && !/^\s*[{[]/.test(input)) {
    // Without a status line, require real header names: YAML also looks like "key: value".
    const names = headerLines.map((l) => l.slice(0, l.indexOf(":")).toLowerCase());
    const indented = input.split(/\r?\n/).some((l) => /^\s+\S/.test(l));
    if (!indented && names.some((n) => KNOWN_HEADERS.has(n) || n.startsWith("x-"))) return hit("http-headers", 0.85);
  }
  return null;
};

// 2001-09-09 .. 2100-01-01: a reasonable range for real-world timestamps.
const MIN_TS = 1_000_000_000;
const MAX_TS = 4_102_444_800;

export const detectTimestamp: KindDetector = (input) => {
  const text = input.trim();
  if (/^\d{10}$/.test(text)) {
    const n = Number(text);
    return n >= MIN_TS && n < MAX_TS ? hit("timestamp", 0.8) : null;
  }
  if (/^\d{13}$/.test(text)) {
    const n = Number(text) / 1000;
    return n >= MIN_TS && n < MAX_TS ? hit("timestamp", 0.8) : null;
  }
  return null;
};

export const detectIsoDate: KindDetector = (input) => {
  const text = input.trim();
  const iso = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  return iso.test(text) && !Number.isNaN(Date.parse(text)) ? hit("iso-date", 0.9) : null;
};

export const detectUuid: KindDetector = (input) =>
  /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(input.trim()) ? hit("uuid", 0.97) : null;

export const detectColor: KindDetector = (input) => {
  const text = input.trim();
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text)) return hit("color", 0.9);
  if (/^(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([^()]*\)$/i.test(text)) return hit("color", 0.95);
  return null;
};

const CRON_FIELD = /^(\*|\?|[0-9A-Z]+([-/][0-9A-Z]+)?|\*\/\d+)(,(\*|[0-9A-Z]+([-/][0-9A-Z]+)?|\*\/\d+))*[LW#0-9]*$/i;

export const detectCron: KindDetector = (input) => {
  const text = input.trim();
  if (/^@(yearly|annually|monthly|weekly|daily|midnight|hourly|reboot)$/i.test(text)) return hit("cron", 0.9);
  const fields = text.split(/\s+/);
  if (fields.length < 5 || fields.length > 6) return null;
  if (!fields.every((f) => CRON_FIELD.test(f))) return null;
  // A plain list of numbers is more likely data than a schedule.
  return fields.some((f) => /[*/?,-]/.test(f)) ? hit("cron", 0.85) : hit("cron", 0.5);
};

const MERMAID_START =
  /^(graph|flowchart)\s+(TB|TD|BT|RL|LR)\b|^(graph|flowchart)\s*$|^(sequenceDiagram|classDiagram(-v2)?|stateDiagram(-v2)?|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|sankey(-beta)?|xychart(-beta)?|block(-beta)?|packet(-beta)?|kanban|architecture(-beta)?|radar(-beta)?|treemap(-beta)?)\b/;

export const detectMermaid: KindDetector = (input) => {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("%%"));
  let i = 0;
  // Skip an optional YAML front matter block.
  if (lines[0] === "---") {
    i = lines.indexOf("---", 1) + 1;
    if (i === 0) return null;
  }
  const first = lines[i];
  return first && MERMAID_START.test(first) ? hit("mermaid", 0.95) : null;
};

export const detectSql: KindDetector = (input) =>
  /^\s*(SELECT\s|INSERT\s+INTO\s|UPDATE\s+\S+\s+SET\s|DELETE\s+FROM\s|CREATE\s+(OR\s+REPLACE\s+)?(TEMP(ORARY)?\s+)?(TABLE|INDEX|VIEW|UNIQUE\s+INDEX)\s|ALTER\s+TABLE\s|DROP\s+(TABLE|INDEX|VIEW)\s|WITH\s+\w+\s+AS\s*\()/i.test(
    input,
  )
    ? hit("sql", 0.85)
    : null;

const HTML_TAG =
  /<(!doctype\s+html|html|head|body|div|span|p|a|img|ul|ol|li|section|article|header|footer|nav|main|button|input|form|table|h[1-6]|script|style|link|meta|br)\b/i;

/** An SVG document, with or without XML prolog, comments or doctype before it. */
const SVG_ROOT = /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>/]/i;

export const detectSvg: KindDetector = (input) =>
  SVG_ROOT.test(input.trim()) && /<\/svg>\s*$|\/>\s*$/i.test(input.trim()) ? hit("svg", 0.97) : null;

/** WiFi and contact payloads that only make sense inside a QR code. */
export const detectQrPayload: KindDetector = (input) =>
  /^(WIFI:(T|S|P|H):|BEGIN:VCARD\r?\n|MECARD:)/i.test(input.trim()) ? hit("qr-payload", 0.95) : null;

export const detectXml: KindDetector = (input) => {
  const text = input.trim();
  // SVG has its own tools.
  if (SVG_ROOT.test(text)) return null;
  if (text.startsWith("<?xml")) return hit("xml", 0.97);
  if (!/^<[A-Za-z_][\w:.-]*[\s>/]/.test(text) || !text.endsWith(">")) return null;
  return HTML_TAG.test(text.slice(0, 200)) ? null : hit("xml", 0.75);
};

export const detectJson: KindDetector = (input) => {
  const text = input.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return null;
  try {
    JSON.parse(text);
    return hit("json", 0.95);
  } catch {
    // Starts like JSON but is invalid: send it to the validator, which marks the error.
    return hit("json", 0.7);
  }
};

export const detectHtml: KindDetector = (input) => {
  const text = input.trim();
  if (/^<!doctype\s+html/i.test(text)) return hit("html", 0.97);
  if (!text.startsWith("<") || !HTML_TAG.test(text)) return null;
  // A complete fragment (<div>…</div>) is surely HTML; a partial one may be something else.
  return hit("html", text.endsWith(">") ? 0.9 : 0.8);
};

const YAML_LINE = /^\s*(- )?[\w"'./$-][^:=]*:(\s|$)|^\s*- \S|^---$/;

export const detectYaml: KindDetector = (input) => {
  const text = input.trim();
  if (/^[{[<]/.test(text) || detectHttpHeaders(input) || detectMermaid(input)) return null;
  const lines = input.split(/\r?\n/).filter((l) => l.trim() !== "" && !l.trim().startsWith("#"));
  if (lines.length < 2 || !YAML_LINE.test(lines[0])) return null;
  const matching = lines.filter((l) => YAML_LINE.test(l)).length;
  if (matching / lines.length < 0.8) return null;
  const structured = text.startsWith("---") || lines.some((l) => /^\s+\S/.test(l) || /^\s*- /.test(l));
  return hit("yaml", structured ? 0.8 : 0.55);
};

/** Count of `delimiter` outside double quotes. */
function countDelimiters(line: string, delimiter: string): number {
  let n = 0;
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === delimiter && !quoted) n++;
  }
  return n;
}

export const detectCsv: KindDetector = (input) => {
  const text = input.trim();
  if (/^[{[<]/.test(text)) return null;
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return null;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = lines.map((l) => countDelimiters(l, d));
    if (counts[0] >= 1 && counts.every((c) => c === counts[0])) return hit("csv", counts[0] >= 2 ? 0.8 : 0.6);
  }
  return null;
};

const ENV_LINE = /^(export\s+)?[A-Za-z_][A-Za-z0-9_.]*\s*=/;

export const detectEnv: KindDetector = (input) => {
  const lines = nonEmptyLines(input).filter((l) => !l.startsWith("#"));
  if (lines.length === 0) return null;
  const matches = lines.filter((l) => ENV_LINE.test(l)).length;
  if (matches / lines.length < 0.8) return null;
  if (matches >= 2) return hit("env", matches === lines.length ? 0.9 : 0.8);
  return hit("env", 0.5);
};

export const detectEncodedText: KindDetector = (input) => {
  // Whole documents (HTML, URLs) have better tools; this is for loose encoded text.
  if (detectHtml(input) || detectUrl(input)) return null;
  if (/&(amp|lt|gt|quot|apos|nbsp|#\d{2,6}|#x[0-9a-f]{2,6});/i.test(input)) return hit("html-entities", 0.6);
  if (/%[0-9a-f]{2}/i.test(input) && !/\s/.test(input.trim())) return hit("url-encoded", 0.65);
  return null;
};

/** CREATE TABLE statements: a schema that can be drawn as an ER diagram. */
export const detectSqlDdl: KindDetector = (input) =>
  /\bcreate\s+(?:or\s+replace\s+)?(?:temp(?:orary)?\s+)?table\s+(?:if\s+not\s+exists\s+)?[\w"`[.\]]+\s*\(/i.test(input)
    ? hit("sql-ddl", 0.9)
    : null;

/** OpenAPI 3 or Swagger 2 documents, in YAML or JSON. */
export const detectOpenApi: KindDetector = (input) =>
  /^\s*(?:openapi:\s*["']?3\.|swagger:\s*["']?2\.0)|^\s*\{[\s\S]{0,200}"(?:openapi"\s*:\s*"3\.|swagger"\s*:\s*"2\.0)/m.test(
    input,
  )
    ? hit("openapi", 0.97)
    : null;

/** JSON Schema documents: a $schema URI, or an object schema with properties. */
export const detectJsonSchema: KindDetector = (input) => {
  const text = input.trim();
  if (!text.startsWith("{")) return null;
  if (/"\$schema"\s*:\s*"https?:\/\/json-schema\.org/.test(text)) return hit("json-schema", 0.97);
  return /"type"\s*:\s*"object"/.test(text) && /"properties"\s*:\s*\{/.test(text) ? hit("json-schema", 0.75) : null;
};

/** Browser and bot User-Agent strings. */
export const detectUserAgent: KindDetector = (input) => {
  const text = input.trim();
  if (/\n/.test(text) || text.length < 10) return null;
  if (/^Mozilla\/\d\.\d \(/.test(text)) return hit("user-agent", 0.95);
  if (/^(Opera|Dalvik|okhttp|PostmanRuntime|python-requests|Go-http-client|axios)\/[\d.]+/i.test(text))
    return hit("user-agent", 0.85);
  return null;
};

const SEMVER = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const COMPARATOR = /^(?:[\^~]|[<>]=?|=)?v?(?:\d+|x|X|\*)(?:\.(?:\d+|x|X|\*)){0,2}(?:-[0-9A-Za-z.-]+)?$/;

/** A semantic version (1.4.0-beta.1) or an npm range (^1.2.3, >=1 <2 || 3.x). */
export const detectSemver: KindDetector = (input) => {
  const text = input.trim();
  if (SEMVER.test(text)) return hit("semver", 0.7);
  if (!/[\^~<>]|\|\||\.[xX*]\b/.test(text)) return null;
  const tokens = text.split(/\s*\|\|\s*|\s+-\s+|\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => COMPARATOR.test(t)) ? hit("semver", 0.9) : null;
};

/** A three-digit number in the HTTP status range: could be a status code. */
export const detectHttpStatus: KindDetector = (input) =>
  /^[1-5]\d\d$/.test(input.trim()) ? hit("http-status", 0.6) : null;

/** An IANA time zone name such as "Europe/Madrid" or "America/Argentina/Buenos_Aires". */
export const detectTimeZone: KindDetector = (input) => {
  const text = input.trim();
  if (!/^(UTC|[A-Z][A-Za-z_-]+(\/[A-Za-z0-9_+-]+)+)$/.test(text)) return null;
  return isTimeZone(text) ? hit("timezone", 0.9) : null;
};

/** A JavaScript regex literal: /pattern/flags with at least one regex construct. */
export const detectRegex: KindDetector = (input) => {
  const m = /^\/([^\n]+)\/([dgimsuvy]*)$/.exec(input.trim());
  if (!m) return null;
  // "/api/users/" is a path, not a regex.
  if (!/\\[dwsbDWSB.]|[\^$[\]()+*?{}|]/.test(m[1])) return null;
  try {
    new RegExp(m[1], m[2]);
    return hit("regex", 0.9);
  } catch {
    return null;
  }
};

/** Base64 of gzip data always starts with "H4sI" (bytes 1F 8B 08). */
export const detectGzip: KindDetector = (input) => {
  const text = input.trim();
  return /^H4sI[A-Za-z0-9+/=_-]{8,}$/.test(text) ? hit("gzip", 0.95) : null;
};

/** Internationalised domain names: non-ASCII labels or their xn-- (Punycode) form. */
export const detectIdn: KindDetector = (input) => {
  const text = input.trim();
  if (!/^(?:[^\s@]+@)?(?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]{2,}$/u.test(text)) return null;
  const host = text.slice(text.lastIndexOf("@") + 1);
  return /[^\x00-\x7f]/.test(host) || /(^|\.)xn--/i.test(host) ? hit("idn", 0.9) : null;
};

/** Number literals (0xFF, 0b1010, 0o17) and byte sequences in binary or hex. */
export const detectRadix: KindDetector = (input) => {
  const text = input.trim();
  if (/^-?0x[0-9a-f]+$|^-?0b[01]+$|^-?0o[0-7]+$/i.test(text)) return hit("radix", 0.9);
  if (/^[01]{8}(\s+[01]{8})+$/.test(text)) return hit("radix", 0.9);
  if (/^[0-9a-f]{2}(\s+[0-9a-f]{2}){2,}$/i.test(text)) return hit("radix", 0.7);
  return null;
};

/** Zero-width characters, bidi controls, BOM or soft hyphens hidden in the text. */
export const detectInvisibleChars: KindDetector = (input) =>
  /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/.test(input) ? hit("invisible-chars", 0.9) : null;

export const detectBase64: KindDetector = (input) => {
  const text = input.trim();
  if (text.length < 8 || /\s/.test(text) || detectGzip(text)) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text) && !/^[A-Za-z0-9_-]+$/.test(text)) return null;
  if (/^\d+$/.test(text) || /^[a-z]+$/i.test(text)) return null;
  try {
    const decoded = base64UrlToText(text);
    const printable = decoded.replace(/[\x20-\x7e\t\r\n\u00A0-￿]/g, "").length === 0;
    return hit("base64", printable ? 0.55 : 0.3);
  } catch {
    return text.length % 4 === 0 ? hit("base64", 0.3) : null;
  }
};

/** An IP address or CIDR block: "10.0.0.0/16", "192.168.1.10", "2001:db8::/32". */
export const detectCidr: KindDetector = (input) => {
  const m = /^(\S+?)(?:\/(\d{1,3}))?$/.exec(input.trim());
  if (!m || !/[.:]/.test(m[1])) return null;
  const ip = parseIp(m[1]);
  if (!ip) return null;
  if (m[2] !== undefined) return Number(m[2]) <= (ip.version === 4 ? 32 : 128) ? hit("cidr", 0.95) : null;
  return hit("cidr", ip.version === 4 ? 0.8 : 0.85);
};

/** Unix permissions: "chmod 755 file", "-rw-r--r--", "rwxr-xr-x" or a bare octal mode. */
export const detectChmod: KindDetector = (input) => {
  const text = input.trim();
  if (/^chmod\s+(-\w+\s+)*([0-7]{3,4}|[ugoa]*[-+=][rwxXst]+)/.test(text)) return hit("chmod", 0.95);
  if (/^[-dl]?([r-][w-][xsS-]){2}[r-][w-][xtT-][.+@]?$/.test(text)) return hit("chmod", 0.95);
  if (/^0?[0-7]{3}$/.test(text)) return hit("chmod", 0.45);
  return null;
};

const MARKDOWN_SIGNALS = [
  /^#{1,6}\s+\S/m, // heading
  /^\s*[-*+]\s+(\[[ xX]\]\s+)?\S/m, // list or task list
  /^\s*\d+\.\s+\S/m, // ordered list
  /\[[^\]\n]+\]\([^)\s]+\)/, // link or image
  /^(```|~~~)/m, // fenced code
  /^>\s?\S/m, // blockquote
  /(\*\*|__)[^*_\n]+\1/, // bold
  /^\|.+\|\s*\n\|[\s:|-]+\|/m, // table
];

/** Markdown documents: several distinct Markdown constructs in the text. */
export const detectMarkdown: KindDetector = (input) => {
  const text = input.trim();
  if (/^[{[<]/.test(text) || !text.includes("\n")) return null;
  const signals = MARKDOWN_SIGNALS.filter((re) => re.test(text)).length;
  if (signals >= 3) return hit("markdown", 0.85);
  return signals === 2 ? hit("markdown", 0.6) : null;
};

/** A single identifier in a programming case style (userId, user_id, USER_ID, user-id). */
export const detectIdentifier: KindDetector = (input) => {
  const text = input.trim();
  const style = detectCase(text);
  // dot.case is skipped: it is far more likely a domain or a file name.
  return style && style !== "dot" && text.length <= 80 ? hit("identifier", 0.6) : null;
};

/** CSS lengths in px, rem or em: "24px", "1.5rem", "16px 24px". */
export const detectCssLength: KindDetector = (input) =>
  /^(-?\d*\.?\d+(px|rem|em)\s*)+$/.test(input.trim()) ? hit("css-length", 0.9) : null;

/** A box-shadow declaration or value: "0 4px 12px rgb(0 0 0 / .2)". */
export const detectBoxShadow: KindDetector = (input) => {
  const text = input.trim();
  if (/^box-shadow\s*:/i.test(text)) return parseBoxShadow(text) ? hit("box-shadow", 0.97) : null;
  // A bare value needs at least one length with px and a color or inset.
  if (!/\dpx/.test(text) || !/(#|rgb|hsl|oklch|inset|black|white)/i.test(text)) return null;
  return parseBoxShadow(text) ? hit("box-shadow", 0.85) : null;
};

/** linear-, radial- or conic-gradient(), repeating or not. */
export const detectGradient: KindDetector = (input) => (parseGradient(input) ? hit("gradient", 0.97) : null);

/** cubic-bezier() timing functions. Bare keywords like "ease" are too ambiguous. */
export const detectCubicBezier: KindDetector = (input) => {
  const text = input.trim();
  if (!/cubic-bezier\(/i.test(text)) return null;
  return parseBezier(text).ok ? hit("cubic-bezier", 0.97) : null;
};

/** Detectors, from most specific to most general. */
export const detectors: readonly KindDetector[] = [
  detectInvisibleChars,
  detectRegex,
  detectCurl,
  detectQrPayload,
  detectDockerRun,
  detectJwt,
  detectPem,
  detectUrl,
  detectCidr,
  detectChmod,
  detectUserAgent,
  detectIdn,
  detectHttpHeaders,
  detectTimestamp,
  detectIsoDate,
  detectTimeZone,
  detectUuid,
  detectBcrypt,
  detectRadix,
  detectSemver,
  detectHttpStatus,
  detectGradient,
  detectCubicBezier,
  detectBoxShadow,
  detectCssLength,
  detectColor,
  detectCron,
  detectMermaid,
  detectOpenApi,
  detectSqlDdl,
  detectSql,
  detectSvg,
  detectXml,
  detectJwk,
  detectJsonSchema,
  detectJson,
  detectHtml,
  detectMarkdown,
  detectYaml,
  detectCsv,
  detectEnv,
  detectEncodedText,
  detectIdentifier,
  detectGzip,
  detectBase64,
];

/** Every match, in specificity order, at most one per kind. */
export function detectAll(input: string): KindDetection[] {
  if (input.trim() === "") return [];
  const seen = new Set<DataKind>();
  const out: KindDetection[] = [];
  for (const detector of detectors) {
    const result = detector(input);
    if (result && !seen.has(result.kind)) {
      seen.add(result.kind);
      out.push(result);
    }
  }
  return out;
}

/** The most likely kind (highest confidence, ties broken by specificity). */
export function detectKind(input: string): KindDetection | null {
  return detectAll(input).reduce<KindDetection | null>(
    (best, d) => (best === null || d.confidence > best.confidence ? d : best),
    null,
  );
}
