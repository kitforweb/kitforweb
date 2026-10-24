import { describe, expect, it } from "vitest";
import { analyzeJson, formatJson, minifyJson, positionAt, sortKeys } from "./analyze";

describe("positionAt", () => {
  it("returns 1-based line and column", () => {
    expect(positionAt("ab\ncd", 0)).toEqual({ line: 1, column: 1 });
    expect(positionAt("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
  });
});

describe("analyzeJson", () => {
  it("accepts valid JSON", () => {
    const r = analyzeJson('{"a": [1, true, null]}');
    expect(r).toEqual({ ok: true, value: { a: [1, true, null] } });
  });

  it("treats empty input as no result without issues", () => {
    expect(analyzeJson("   ")).toEqual({ ok: false, issues: [] });
  });

  it("reports a missing comma at its exact position", () => {
    const text = '{\n  "a": 1\n  "b": 2\n}';
    const r = analyzeJson(text);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues[0]).toMatchObject({ code: "CommaExpected", line: 3, column: 3 });
  });

  it("reports every error, not only the first", () => {
    const r = analyzeJson('{"a": 1 "b": 2, "c": }');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.length).toBeGreaterThanOrEqual(2);
    expect(r.issues.map((i) => i.code)).toContain("CommaExpected");
    expect(r.issues.map((i) => i.code)).toContain("ValueExpected");
  });

  it("flags trailing commas once, and comments", () => {
    const trailing = analyzeJson('{"a": 1,}');
    const comment = analyzeJson('{"a": 1 // nope\n}');
    expect(trailing.ok).toBe(false);
    if (!trailing.ok) expect(trailing.issues).toHaveLength(1);
    expect(comment.ok).toBe(false);
    if (!comment.ok) expect(comment.issues[0].code).toBe("InvalidCommentToken");
  });

  it("flags an unclosed brace", () => {
    const r = analyzeJson('{"a": {"b": 1}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.code)).toContain("CloseBraceExpected");
  });
});

describe("formatting", () => {
  const value = { b: 1, a: { d: [1, 2], c: "x" } };

  it("formats with spaces or tabs", () => {
    expect(formatJson({ a: 1 }, 2)).toBe('{\n  "a": 1\n}');
    expect(formatJson({ a: 1 }, "tab")).toBe('{\n\t"a": 1\n}');
  });

  it("minifies", () => {
    expect(minifyJson(value)).toBe('{"b":1,"a":{"d":[1,2],"c":"x"}}');
  });

  it("sorts keys recursively, keeping array order", () => {
    expect(minifyJson(sortKeys(value))).toBe('{"a":{"c":"x","d":[1,2]},"b":1}');
  });
});
