/**
 * .env parser following the dotenv rules: `export` prefix, # comments, single
 * quotes (literal), double quotes (with \n escapes, may span lines), backticks
 * and inline comments after unquoted values. It also reports what other parsers
 * silently accept or drop: duplicate keys, broken quotes, invalid names.
 */

export type EnvIssueCode =
  | "duplicate"
  | "unterminated-quote"
  | "stray-quote"
  | "invalid-key"
  | "missing-equals"
  | "spaces-around-equals"
  | "unquoted-spaces";

export interface EnvIssue {
  code: EnvIssueCode;
  line: number;
  key?: string;
  /** Line of the first definition, for duplicates. */
  first?: number;
}

export interface EnvEntry {
  key: string;
  value: string;
  line: number;
}

export interface EnvParse {
  entries: EnvEntry[];
  issues: EnvIssue[];
}

const KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

function unescapeDouble(s: string): string {
  return s.replace(/\\([nrt"\\$])/g, (_, c: string) => (c === "n" ? "\n" : c === "r" ? "\r" : c === "t" ? "\t" : c));
}

export function parseEnv(text: string): EnvParse {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const entries: EnvEntry[] = [];
  const issues: EnvIssue[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const body = trimmed.replace(/^export\s+/, "");
    const eq = body.indexOf("=");
    if (eq < 0) {
      issues.push({ code: "missing-equals", line: lineNo });
      continue;
    }
    const rawKey = body.slice(0, eq);
    const key = rawKey.trim();
    let rest = body.slice(eq + 1);
    if (!KEY.test(key)) {
      issues.push({ code: "invalid-key", line: lineNo, key });
      continue;
    }
    if (rawKey !== key || /^\s/.test(rest)) issues.push({ code: "spaces-around-equals", line: lineNo, key });
    rest = rest.trimStart();

    let value: string;
    const quote = rest[0];
    if (quote === '"' || quote === "'" || quote === "`") {
      // Find the closing quote, possibly on a later line.
      let content = rest.slice(1);
      let close = findClose(content, quote);
      let endLine = i;
      while (close < 0 && endLine + 1 < lines.length && quote !== "'") {
        endLine++;
        content += "\n" + lines[endLine];
        close = findClose(content, quote);
      }
      if (close < 0 && quote === "'") {
        // Single-quoted values may also span lines in dotenv.
        while (close < 0 && endLine + 1 < lines.length) {
          endLine++;
          content += "\n" + lines[endLine];
          close = content.indexOf("'");
        }
      }
      if (close < 0) {
        issues.push({ code: "unterminated-quote", line: lineNo, key });
        // Treat the rest of the line as the value so the key is not lost.
        value = rest.slice(1);
      } else {
        const inner = content.slice(0, close);
        value = quote === '"' ? unescapeDouble(inner) : inner;
        const after = content.slice(close + 1).trim();
        if (after !== "" && !after.startsWith("#")) issues.push({ code: "stray-quote", line: lineNo, key });
        i = endLine;
      }
    } else {
      const hash = rest.search(/\s#/);
      value = (hash >= 0 ? rest.slice(0, hash) : rest).trim();
      if (/["'`]/.test(value)) issues.push({ code: "stray-quote", line: lineNo, key });
      else if (/\s/.test(value)) issues.push({ code: "unquoted-spaces", line: lineNo, key });
    }

    const first = seen.get(key);
    if (first !== undefined) {
      issues.push({ code: "duplicate", line: lineNo, key, first });
      // Last definition wins, as in most loaders; keep the original position.
      const idx = entries.findIndex((e) => e.key === key);
      entries.splice(idx, 1);
    } else seen.set(key, lineNo);
    entries.push({ key, value, line: lineNo });
  }
  return { entries, issues };
}

function findClose(s: string, quote: string): number {
  for (let j = 0; j < s.length; j++) {
    if (s[j] === "\\" && quote === '"') j++;
    else if (s[j] === quote) return j;
  }
  return -1;
}

export interface EnvToJsonOptions {
  /** Turn "42", "true", "false" and "null" into JSON numbers, booleans and null. */
  typed?: boolean;
  /** Turn KEY__SUB into nested objects { KEY: { SUB } }. */
  nest?: boolean;
}

function typedValue(v: string): unknown {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v) && Number.isSafeInteger(Math.trunc(Number(v)))) return Number(v);
  return v;
}

export function envToObject(parse: EnvParse, options: EnvToJsonOptions = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { key, value } of parse.entries) {
    const v = options.typed ? typedValue(value) : value;
    if (!options.nest || !key.includes("__")) {
      out[key] = v;
      continue;
    }
    const path = key.split("__").filter(Boolean);
    let node = out;
    for (const part of path.slice(0, -1)) {
      if (typeof node[part] !== "object" || node[part] === null) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    node[path[path.length - 1]] = v;
  }
  return out;
}

/** Quotes a value only when a .env loader (or a shell sourcing the file) needs it. */
export function envValue(value: string): string {
  if (value === "") return "";
  if (/^[\w@%+=:,./-]+$/.test(value)) return value;
  if (!value.includes("'") && !value.includes("\n")) return `'${value}'`;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\$/g, "\\$")}"`;
}

export type JsonToEnvResult =
  | { ok: true; output: string; flattened: number }
  | { ok: false; error: "invalid-json" | "not-object"; message?: string; line?: number; column?: number };

/** A flat (or nested, joined with __) JSON object as KEY=value lines. */
export function jsonToEnv(json: string, options: { uppercase?: boolean } = {}): JsonToEnvResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: "invalid-json", message: e instanceof Error ? e.message : String(e) };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return { ok: false, error: "not-object" };
  const lines: string[] = [];
  let flattened = 0;
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const rawKey = prefix ? `${prefix}__${k}` : k;
      const key = (options.uppercase ? rawKey.toUpperCase() : rawKey).replace(/[^A-Za-z0-9_.]/g, "_");
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        flattened++;
        walk(v as Record<string, unknown>, rawKey);
      } else if (Array.isArray(v)) lines.push(`${key}=${envValue(JSON.stringify(v))}`);
      else lines.push(`${key}=${v === null ? "" : envValue(String(v))}`);
    }
  };
  walk(data as Record<string, unknown>, "");
  return { ok: true, output: lines.join("\n") + (lines.length > 0 ? "\n" : ""), flattened };
}
