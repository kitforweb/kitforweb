export type DiffKind = "added" | "removed" | "changed";

export interface DiffEntry {
  path: string;
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** `user.address.city`, `items[2]`, `meta["content-type"]`. */
export function joinPath(base: string, key: string | number): string {
  if (typeof key === "number") return `${base}[${key}]`;
  if (IDENT.test(key)) return base ? `${base}.${key}` : key;
  return `${base}[${JSON.stringify(key)}]`;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function walk(a: unknown, b: unknown, path: string, out: DiffEntry[]): void {
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const p = joinPath(path, i);
      if (i >= a.length) out.push({ path: p, kind: "added", after: b[i] });
      else if (i >= b.length) out.push({ path: p, kind: "removed", before: a[i] });
      else walk(a[i], b[i], p, out);
    }
    return;
  }
  if (isObject(a) && isObject(b)) {
    // Key order is irrelevant: only membership and values matter.
    for (const k of Object.keys(a)) {
      const p = joinPath(path, k);
      if (!(k in b)) out.push({ path: p, kind: "removed", before: a[k] });
      else walk(a[k], b[k], p, out);
    }
    for (const k of Object.keys(b)) if (!(k in a)) out.push({ path: joinPath(path, k), kind: "added", after: b[k] });
    return;
  }
  if (!Object.is(a, b)) out.push({ path: path || "(root)", kind: "changed", before: a, after: b });
}

/** Differences between two JSON values, by path. Arrays are compared by index. */
export function diffJson(a: unknown, b: unknown): DiffEntry[] {
  const out: DiffEntry[] = [];
  walk(a, b, "", out);
  return out;
}

export function summarize(entries: DiffEntry[]): Record<DiffKind, number> {
  const s: Record<DiffKind, number> = { added: 0, removed: 0, changed: 0 };
  for (const e of entries) s[e.kind]++;
  return s;
}
