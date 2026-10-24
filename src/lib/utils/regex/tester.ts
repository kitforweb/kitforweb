export interface MatchInfo {
  index: number;
  end: number;
  text: string;
  /** Numbered capture groups (undefined when the group did not take part). */
  groups: (string | undefined)[];
  named?: Record<string, string | undefined>;
}

export interface LineResult {
  line: string;
  matched: boolean;
  matches: MatchInfo[];
}

export type TestResult = { ok: true; lines: LineResult[] } | { ok: false; error: string };

export interface TestRequest {
  source: string;
  flags: string;
  text: string;
  /** "lines": every line is a separate test case. "text": the whole text at once. */
  mode: "lines" | "text";
  maxMatches?: number;
}

function collect(re: RegExp, text: string, max: number): MatchInfo[] {
  const out: MatchInfo[] = [];
  if (re.global || re.sticky) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && out.length < max) {
      out.push(toInfo(m));
      // Avoid infinite loops on empty matches.
      if (m[0] === "") re.lastIndex += 1;
    }
  } else {
    const m = re.exec(text);
    if (m) out.push(toInfo(m));
  }
  return out;
}

function toInfo(m: RegExpExecArray): MatchInfo {
  return {
    index: m.index,
    end: m.index + m[0].length,
    text: m[0],
    groups: m.slice(1),
    ...(m.groups ? { named: { ...m.groups } } : {}),
  };
}

/** Runs a regex against test cases. Invalid patterns return the engine's error. */
export function runRegexTest({ source, flags, text, mode, maxMatches = 1000 }: TestRequest): TestResult {
  let re: RegExp;
  try {
    re = new RegExp(source, flags);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const cases = mode === "lines" ? text.split(/\r?\n/) : [text];
  const lines = cases.map((line) => {
    const matches = collect(re, line, maxMatches);
    return { line, matched: matches.length > 0, matches };
  });
  return { ok: true, lines };
}

/** Splits a line into plain and matched segments for highlighting. */
export function segments(line: string, matches: MatchInfo[]): { text: string; match: boolean }[] {
  const out: { text: string; match: boolean }[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.index > pos) out.push({ text: line.slice(pos, m.index), match: false });
    if (m.end > m.index) out.push({ text: line.slice(m.index, m.end), match: true });
    pos = Math.max(pos, m.end);
  }
  if (pos < line.length) out.push({ text: line.slice(pos), match: false });
  return out;
}

export const VALID_FLAGS = "dgimsuvy";

export function normalizeFlags(flags: string): string {
  return [...new Set(flags.split(""))].filter((f) => VALID_FLAGS.includes(f)).join("");
}
