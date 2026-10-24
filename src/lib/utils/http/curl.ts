import { tokenize } from "../shell/tokenize";

/** A cURL command, as copied from DevTools ("Copy as cURL"), parsed. */
export interface ParsedCurl {
  url: string;
  method: string;
  headers: [string, string][];
  /** Raw body (--data*, --json). */
  body?: string;
  /** Multipart fields (-F). Values starting with @ are files. */
  form?: [string, string][];
  /** Basic auth from -u user:password. */
  auth?: { user: string; password: string };
  warnings: string[];
}

export type CurlResult = { ok: true; curl: ParsedCurl } | { ok: false; error: "not-curl" | "no-url" | "quotes" };

const DATA_FLAGS = new Set(["-d", "--data", "--data-raw", "--data-binary", "--data-ascii", "--data-urlencode"]);
const IGNORED_WITH_VALUE = new Set([
  "-o",
  "--output",
  "--connect-timeout",
  "-m",
  "--max-time",
  "--retry",
  "-w",
  "--write-out",
  "--proxy",
  "-x",
  "--cacert",
  "--cert",
  "--key",
]);

export function parseCurl(command: string): CurlResult {
  const tokens = tokenize(command.trim());
  if (!tokens) return { ok: false, error: "quotes" };
  if (!tokens.length || !/^curl(\.exe)?$/i.test(tokens[0])) return { ok: false, error: "not-curl" };
  const curl: ParsedCurl = { url: "", method: "", headers: [], warnings: [] };
  const data: string[] = [];
  let get = false;

  for (let i = 1; i < tokens.length; i++) {
    let flag = tokens[i];
    let value: string | undefined;
    // --flag=value and -XPOST forms.
    const eq = /^(--[a-z-]+)=(.*)$/s.exec(flag);
    if (eq) [, flag, value] = eq;
    else if (/^-[XHdAbeuF]./.test(flag) && !flag.startsWith("--")) {
      value = flag.slice(2);
      flag = flag.slice(0, 2);
    }
    const next = () => value ?? tokens[++i] ?? "";

    if (flag === "-X" || flag === "--request") curl.method = next().toUpperCase();
    else if (flag === "-H" || flag === "--header") {
      const h = next();
      const idx = h.indexOf(":");
      if (idx > 0) curl.headers.push([h.slice(0, idx).trim(), h.slice(idx + 1).trim()]);
    } else if (DATA_FLAGS.has(flag)) {
      const v = next();
      data.push(flag === "--data-urlencode" ? encodeDataUrl(v) : v);
    } else if (flag === "--json") {
      data.push(next());
      setDefault(curl.headers, "Content-Type", "application/json");
      setDefault(curl.headers, "Accept", "application/json");
    } else if (flag === "-F" || flag === "--form") {
      const v = next();
      const idx = v.indexOf("=");
      (curl.form ??= []).push(idx >= 0 ? [v.slice(0, idx), v.slice(idx + 1)] : [v, ""]);
    } else if (flag === "-u" || flag === "--user") {
      const v = next();
      const idx = v.indexOf(":");
      curl.auth = idx >= 0 ? { user: v.slice(0, idx), password: v.slice(idx + 1) } : { user: v, password: "" };
    } else if (flag === "-b" || flag === "--cookie") curl.headers.push(["Cookie", next()]);
    else if (flag === "-A" || flag === "--user-agent") curl.headers.push(["User-Agent", next()]);
    else if (flag === "-e" || flag === "--referer") curl.headers.push(["Referer", next()]);
    else if (flag === "-G" || flag === "--get") get = true;
    else if (flag === "-I" || flag === "--head") curl.method = "HEAD";
    else if (flag === "--url") curl.url = next();
    else if (IGNORED_WITH_VALUE.has(flag)) next();
    else if (flag === "-k" || flag === "--insecure") curl.warnings.push("insecure");
    else if (flag.startsWith("-")) {
      // Boolean flags with no effect on the request (--compressed, -L, -s, -v, -i…).
    } else if (!curl.url) curl.url = flag;
  }

  if (!curl.url) return { ok: false, error: "no-url" };
  if (!/^[a-z]+:\/\//i.test(curl.url)) curl.url = `http://${curl.url}`;
  if (data.length) {
    if (get) {
      const url = new URL(curl.url);
      url.search = [url.search.slice(1), ...data].filter(Boolean).join("&");
      curl.url = url.toString();
    } else {
      curl.body = data.join("&");
      setDefault(curl.headers, "Content-Type", "application/x-www-form-urlencoded");
    }
  }
  curl.method ||= curl.body !== undefined || curl.form ? "POST" : "GET";
  return { ok: true, curl };
}

function encodeDataUrl(v: string): string {
  const idx = v.indexOf("=");
  return idx >= 0 ? `${v.slice(0, idx)}=${encodeURIComponent(v.slice(idx + 1))}` : encodeURIComponent(v);
}

function setDefault(headers: [string, string][], name: string, value: string) {
  if (!headers.some(([n]) => n.toLowerCase() === name.toLowerCase())) headers.push([name, value]);
}

// ---- code generation ----

const q = (s: string) => JSON.stringify(s);
const ident = (s: string) => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : q(s));

function jsonBody(curl: ParsedCurl): unknown | undefined {
  if (curl.body === undefined) return undefined;
  const type = curl.headers.find(([n]) => n.toLowerCase() === "content-type")?.[1] ?? "";
  if (!/json/i.test(type) && !/^\s*[[{]/.test(curl.body)) return undefined;
  try {
    return JSON.parse(curl.body);
  } catch {
    return undefined;
  }
}

function headerLines(curl: ParsedCurl, indent: string, skipContentType = false): string[] {
  const lines = curl.headers
    .filter(([n]) => !(skipContentType && n.toLowerCase() === "content-type"))
    .map(([n, v]) => `${indent}${ident(n)}: ${q(v)},`);
  if (curl.auth)
    lines.push(`${indent}Authorization: "Basic " + btoa(${q(`${curl.auth.user}:${curl.auth.password}`)}),`);
  return lines;
}

function indentJson(value: unknown, indent: string): string {
  return JSON.stringify(value, null, 2).replace(/\n/g, `\n${indent}`);
}

export function toFetch(curl: ParsedCurl): string {
  const json = jsonBody(curl);
  const lines: string[] = [];
  if (curl.form) {
    lines.push("const form = new FormData();");
    for (const [k, v] of curl.form) {
      lines.push(
        v.startsWith("@")
          ? `form.append(${q(k)}, fileInput.files[0]); // ${v.slice(1)}`
          : `form.append(${q(k)}, ${q(v)});`,
      );
    }
    lines.push("");
  }
  lines.push(`const response = await fetch(${q(curl.url)}, {`);
  lines.push(`  method: ${q(curl.method)},`);
  // FormData sets its own multipart Content-Type with the boundary.
  const headers = headerLines(curl, "    ", Boolean(curl.form));
  if (headers.length) lines.push("  headers: {", ...headers, "  },");
  if (curl.form) lines.push("  body: form,");
  else if (json !== undefined) lines.push(`  body: JSON.stringify(${indentJson(json, "  ")}),`);
  else if (curl.body !== undefined) lines.push(`  body: ${q(curl.body)},`);
  lines.push("});", "");
  lines.push(
    json !== undefined || /json/i.test(curl.headers.find(([n]) => /^accept$/i.test(n))?.[1] ?? "")
      ? "const data = await response.json();"
      : "const data = await response.text();",
  );
  return lines.join("\n");
}

export function toAxios(curl: ParsedCurl): string {
  const json = jsonBody(curl);
  const lines = ['import axios from "axios";', ""];
  if (curl.form) {
    lines.push("const form = new FormData();");
    for (const [k, v] of curl.form)
      lines.push(v.startsWith("@") ? `form.append(${q(k)}, fileInput.files[0]);` : `form.append(${q(k)}, ${q(v)});`);
    lines.push("");
  }
  lines.push("const { data } = await axios({");
  lines.push(`  method: ${q(curl.method.toLowerCase())},`, `  url: ${q(curl.url)},`);
  const headers = curl.headers
    .filter(([n]) => !(curl.form && n.toLowerCase() === "content-type"))
    .map(([n, v]) => `    ${ident(n)}: ${q(v)},`);
  if (headers.length) lines.push("  headers: {", ...headers, "  },");
  if (curl.auth) lines.push(`  auth: { username: ${q(curl.auth.user)}, password: ${q(curl.auth.password)} },`);
  if (curl.form) lines.push("  data: form,");
  else if (json !== undefined) lines.push(`  data: ${indentJson(json, "  ")},`);
  else if (curl.body !== undefined) lines.push(`  data: ${q(curl.body)},`);
  lines.push("});");
  return lines.join("\n");
}

export function toAngular(curl: ParsedCurl): string {
  const json = jsonBody(curl);
  const method = curl.method.toLowerCase();
  const headers = headerLines(curl, "    ", Boolean(curl.form));
  const lines = [
    'import { HttpClient, HttpHeaders } from "@angular/common/http";',
    'import { inject } from "@angular/core";',
    "",
    "const http = inject(HttpClient);",
  ];
  if (headers.length)
    lines.push("const headers = new HttpHeaders({", ...headers.map((h) => h.replace(/^ {4}/, "  ")), "});");
  let body = "";
  if (curl.form) {
    lines.push("const form = new FormData();");
    for (const [k, v] of curl.form)
      lines.push(v.startsWith("@") ? `form.append(${q(k)}, file);` : `form.append(${q(k)}, ${q(v)});`);
    body = "form";
  } else if (json !== undefined) body = indentJson(json, "");
  else if (curl.body !== undefined) body = q(curl.body);
  const options = headers.length ? "{ headers }" : "";
  const hasBody = ["post", "put", "patch"].includes(method);
  const args = [q(curl.url), ...(hasBody ? [body || "null"] : []), ...(options ? [options] : [])].join(", ");
  const call = ["get", "post", "put", "patch", "delete", "head"].includes(method)
    ? `http.${method}(${args})`
    : `http.request(${q(curl.method)}, ${q(curl.url)}, { ${[body ? `body: ${body}` : "", headers.length ? "headers" : ""].filter(Boolean).join(", ")} })`;
  lines.push("", `${call}.subscribe((data) => console.log(data));`);
  return lines.join("\n");
}
