import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";

export type JsonErrorCode = ReturnType<typeof printParseErrorCode>;

export interface JsonIssue {
  code: JsonErrorCode;
  /** Character offset where the problem starts. */
  offset: number;
  length: number;
  /** 1-based line and column. */
  line: number;
  column: number;
}

export type JsonAnalysis = { ok: true; value: unknown } | { ok: false; issues: JsonIssue[] };

/** 1-based line/column for a character offset. */
export function positionAt(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: end - lineStart + 1 };
}

/**
 * Validates strict JSON and reports every error (not only the first one), with
 * the exact position of each. Comments and trailing commas are errors.
 */
export function analyzeJson(text: string): JsonAnalysis {
  if (text.trim() === "") return { ok: false, issues: [] };
  const errors: ParseError[] = [];
  parse(text, errors, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
  if (errors.length > 0) {
    // The parser can report several codes for one spot (e.g. a trailing comma):
    // keep the first, which is the most specific.
    const unique = errors.filter((e, i) => errors.findIndex((x) => x.offset === e.offset) === i);
    return {
      ok: false,
      issues: unique.map((e) => ({
        code: printParseErrorCode(e.error),
        offset: e.offset,
        length: Math.max(1, e.length),
        ...positionAt(text, e.offset),
      })),
    };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    // jsonc-parser is slightly more lenient (e.g. control characters in strings).
    return {
      ok: false,
      issues: [{ code: "InvalidCharacter", offset: 0, length: 1, line: 1, column: 1 }],
    };
  }
}

export type IndentOption = 2 | 4 | "tab";

export function formatJson(value: unknown, indent: IndentOption): string {
  return JSON.stringify(value, null, indent === "tab" ? "\t" : indent);
}

export function minifyJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Recursively sorts object keys (arrays keep their order). */
export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}
