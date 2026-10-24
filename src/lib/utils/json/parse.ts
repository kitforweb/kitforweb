import { fail, type ConvertResult } from "../convert/result";
import { analyzeJson } from "./analyze";

export type ParsedJson = { ok: true; value: unknown } | { ok: false; result: ConvertResult };

/** Strict JSON parse that reports the first error with its line and column. */
export function parseJsonStrict(text: string): ParsedJson {
  const analysis = analyzeJson(text);
  if (analysis.ok) return { ok: true, value: analysis.value };
  const first = analysis.issues[0];
  return {
    ok: false,
    result: first ? fail(`Invalid JSON: ${first.code}`, first.line, first.column) : fail("Empty input"),
  };
}
