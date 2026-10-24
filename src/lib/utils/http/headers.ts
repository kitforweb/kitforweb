export type HeaderCategory = "cache" | "cors" | "cookies" | "security" | "content" | "connection" | "auth" | "info";

/** Headers the analyser knows about, by category. Explanations are translated in the UI. */
export const KNOWN_HEADERS: Record<string, HeaderCategory> = {
  "cache-control": "cache",
  expires: "cache",
  etag: "cache",
  "last-modified": "cache",
  age: "cache",
  vary: "cache",
  pragma: "cache",
  "access-control-allow-origin": "cors",
  "access-control-allow-credentials": "cors",
  "access-control-allow-methods": "cors",
  "access-control-allow-headers": "cors",
  "access-control-expose-headers": "cors",
  "access-control-max-age": "cors",
  "set-cookie": "cookies",
  cookie: "cookies",
  "content-security-policy": "security",
  "content-security-policy-report-only": "security",
  "strict-transport-security": "security",
  "x-content-type-options": "security",
  "x-frame-options": "security",
  "referrer-policy": "security",
  "permissions-policy": "security",
  "cross-origin-opener-policy": "security",
  "cross-origin-embedder-policy": "security",
  "cross-origin-resource-policy": "security",
  "x-xss-protection": "security",
  "content-type": "content",
  "content-length": "content",
  "content-encoding": "content",
  "content-language": "content",
  "content-disposition": "content",
  "transfer-encoding": "connection",
  connection: "connection",
  "keep-alive": "connection",
  location: "info",
  date: "info",
  server: "info",
  "x-powered-by": "info",
  "retry-after": "info",
  "www-authenticate": "auth",
  authorization: "auth",
};

export interface ParsedHeader {
  name: string;
  value: string;
  key: string;
  category: HeaderCategory | null;
}

export type IssueId =
  | "missing-csp"
  | "missing-hsts"
  | "missing-nosniff"
  | "missing-frame-protection"
  | "missing-referrer-policy"
  | "short-hsts"
  | "cors-wildcard-credentials"
  | "cookie-not-secure"
  | "cookie-not-httponly"
  | "cookie-no-samesite"
  | "version-disclosure"
  | "deprecated-xss-protection"
  | "no-cache-policy";

export interface HeaderIssue {
  id: IssueId;
  severity: "high" | "medium" | "low";
  /** Header the issue refers to (e.g. the cookie name). */
  detail?: string;
}

export interface HeadersAnalysis {
  status?: { version: string; code: number; text: string };
  headers: ParsedHeader[];
  issues: HeaderIssue[];
}

/** Parses raw response headers as copied from DevTools or `curl -i`. */
export function parseHeaders(raw: string): Pick<HeadersAnalysis, "status" | "headers"> {
  const lines = raw.split(/\r?\n/);
  const headers: ParsedHeader[] = [];
  let status: HeadersAnalysis["status"];
  for (const line of lines) {
    const m = /^(HTTP\/[\d.]+)\s+(\d{3})\s*(.*)$/i.exec(line.trim());
    if (m) {
      status = { version: m[1].toUpperCase(), code: Number(m[2]), text: m[3] };
      continue;
    }
    // Folded continuation lines belong to the previous header.
    if (/^\s+\S/.test(line) && headers.length) {
      headers[headers.length - 1].value += ` ${line.trim()}`;
      continue;
    }
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const name = line.slice(0, idx).trim();
    if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) continue;
    const key = name.toLowerCase();
    headers.push({ name, value: line.slice(idx + 1).trim(), key, category: KNOWN_HEADERS[key] ?? null });
  }
  return { status, headers };
}

export function analyzeHeaders(raw: string): HeadersAnalysis {
  const { status, headers } = parseHeaders(raw);
  const get = (k: string) => headers.find((h) => h.key === k)?.value;
  const issues: HeaderIssue[] = [];
  const isResponse =
    Boolean(status) || headers.some((h) => ["server", "content-type", "set-cookie", "cache-control"].includes(h.key));

  if (isResponse) {
    const csp = get("content-security-policy");
    if (!csp) issues.push({ id: "missing-csp", severity: "high" });
    const hsts = get("strict-transport-security");
    if (!hsts) issues.push({ id: "missing-hsts", severity: "high" });
    else {
      const maxAge = Number(/max-age=(\d+)/i.exec(hsts)?.[1] ?? 0);
      if (maxAge < 15_552_000) issues.push({ id: "short-hsts", severity: "low" });
    }
    if (get("x-content-type-options")?.toLowerCase() !== "nosniff")
      issues.push({ id: "missing-nosniff", severity: "medium" });
    if (!get("x-frame-options") && !/frame-ancestors/i.test(csp ?? ""))
      issues.push({ id: "missing-frame-protection", severity: "medium" });
    if (!get("referrer-policy")) issues.push({ id: "missing-referrer-policy", severity: "low" });
    if (!get("cache-control") && !get("expires")) issues.push({ id: "no-cache-policy", severity: "low" });
  }

  if (get("access-control-allow-origin") === "*" && get("access-control-allow-credentials") === "true") {
    issues.push({ id: "cors-wildcard-credentials", severity: "high" });
  }

  for (const h of headers.filter((x) => x.key === "set-cookie")) {
    const cookieName = h.value.split("=")[0].trim();
    const attrs = h.value.toLowerCase();
    if (!/;\s*secure/.test(attrs)) issues.push({ id: "cookie-not-secure", severity: "medium", detail: cookieName });
    if (!/;\s*httponly/.test(attrs)) issues.push({ id: "cookie-not-httponly", severity: "medium", detail: cookieName });
    if (!/;\s*samesite=/.test(attrs)) issues.push({ id: "cookie-no-samesite", severity: "low", detail: cookieName });
  }

  for (const k of ["server", "x-powered-by", "x-aspnet-version"]) {
    const v = get(k);
    if (v && /\d/.test(v)) issues.push({ id: "version-disclosure", severity: "low", detail: `${k}: ${v}` });
  }
  if (get("x-xss-protection")) issues.push({ id: "deprecated-xss-protection", severity: "low" });

  return { status, headers, issues };
}
