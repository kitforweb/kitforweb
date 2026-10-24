import { createTwoFilesPatch, diffLines, diffWordsWithSpace } from "diff";

/** A fragment of a line: `changed` marks the words that differ from the other side. */
export interface DiffPart {
  text: string;
  changed: boolean;
}

export interface DiffLine {
  /** 1-based line number on its side. */
  n: number;
  parts: DiffPart[];
}

export type DiffRow =
  | { kind: "equal"; left: DiffLine; right: DiffLine }
  | { kind: "replace"; left: DiffLine; right: DiffLine }
  | { kind: "delete"; left: DiffLine }
  | { kind: "insert"; right: DiffLine }
  | { kind: "skip"; count: number };

export interface DiffOptions {
  ignoreWhitespace?: boolean;
  ignoreCase?: boolean;
}

export interface DiffResult {
  rows: DiffRow[];
  added: number;
  removed: number;
  /** True when both texts are equal (under the given options). */
  identical: boolean;
}

export interface DiffRequest extends DiffOptions {
  left: string;
  right: string;
  /** Unchanged lines kept around each change; undefined shows everything. */
  context?: number;
}

const splitLines = (value: string) => {
  const lines = value.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
};

const whole = (text: string): DiffPart[] => [{ text, changed: false }];

/** Word-level comparison of two lines that replace each other. */
function wordParts(a: string, b: string, options: DiffOptions): [DiffPart[], DiffPart[]] {
  const left: DiffPart[] = [];
  const right: DiffPart[] = [];
  for (const c of diffWordsWithSpace(a, b, { ignoreCase: options.ignoreCase })) {
    if (!c.added) left.push({ text: c.value, changed: c.removed });
    if (!c.removed) right.push({ text: c.value, changed: c.added });
  }
  return [left, right];
}

/** Line diff with word highlights inside the lines that changed. */
export function computeDiff(req: DiffRequest): DiffResult {
  const leftLines = splitLines(req.left.replace(/\r\n/g, "\n"));
  const rightLines = splitLines(req.right.replace(/\r\n/g, "\n"));
  const norm = (line: string) => {
    const t = req.ignoreWhitespace ? line.replace(/\s+/g, " ").trim() : line;
    return req.ignoreCase ? t.toLowerCase() : t;
  };
  // Lines are compared normalised, but rows show each side's own text,
  // so they are taken from the line arrays by position, not from the chunks.
  const join = (lines: string[]) => lines.map((l) => norm(l) + "\n").join("");
  const changes = diffLines(join(leftLines), join(rightLines));

  const rows: DiffRow[] = [];
  let li = 0;
  let ri = 0;
  let added = 0;
  let removed = 0;
  const line = (lines: string[], i: number): DiffLine => ({ n: i + 1, parts: whole(lines[i]) });
  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    const count = c.count ?? splitLines(c.value).length;
    if (!c.added && !c.removed) {
      for (let k = 0; k < count; k++)
        rows.push({ kind: "equal", left: line(leftLines, li++), right: line(rightLines, ri++) });
      continue;
    }
    if (c.removed && changes[i + 1]?.added) {
      const insCount = changes[i + 1].count ?? splitLines(changes[i + 1].value).length;
      const pairs = Math.min(count, insCount);
      for (let k = 0; k < pairs; k++) {
        const [lp, rp] = wordParts(leftLines[li], rightLines[ri], req);
        rows.push({ kind: "replace", left: { n: ++li, parts: lp }, right: { n: ++ri, parts: rp } });
      }
      for (let k = pairs; k < count; k++) rows.push({ kind: "delete", left: line(leftLines, li++) });
      for (let k = pairs; k < insCount; k++) rows.push({ kind: "insert", right: line(rightLines, ri++) });
      removed += count;
      added += insCount;
      i++;
      continue;
    }
    if (c.removed) {
      removed += count;
      for (let k = 0; k < count; k++) rows.push({ kind: "delete", left: line(leftLines, li++) });
    } else {
      added += count;
      for (let k = 0; k < count; k++) rows.push({ kind: "insert", right: line(rightLines, ri++) });
    }
  }
  const identical = added === 0 && removed === 0;
  return { rows: req.context === undefined ? rows : collapse(rows, req.context), added, removed, identical };
}

/** Replaces long runs of unchanged rows by a "skip" marker, keeping `context` rows around changes. */
export function collapse(rows: DiffRow[], context: number): DiffRow[] {
  const keep = rows.map(() => false);
  rows.forEach((r, i) => {
    if (r.kind === "equal") return;
    for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = true;
  });
  const out: DiffRow[] = [];
  let skipped = 0;
  rows.forEach((r, i) => {
    if (keep[i] || r.kind !== "equal") {
      if (skipped > 0) out.push({ kind: "skip", count: skipped });
      skipped = 0;
      out.push(r);
    } else skipped++;
  });
  if (skipped > 0) out.push({ kind: "skip", count: skipped });
  return out;
}

/** The comparison as a unified patch (what `git diff` prints). */
export function unifiedPatch(left: string, right: string, names: [string, string] = ["original", "modified"]): string {
  return createTwoFilesPatch(names[0], names[1], left, right, undefined, undefined, { context: 3 });
}
