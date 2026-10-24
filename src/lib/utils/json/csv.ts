import Papa from "papaparse";
import { fail, ok, type ConvertResult } from "../convert/result";
import { parseJsonStrict } from "./parse";

type Flat = Record<string, unknown>;

/** `{ a: { b: 1 }, tags: ["x"] }` → `{ "a.b": 1, "tags.0": "x" }`. */
export function flatten(value: unknown, prefix = "", out: Flat = {}): Flat {
  if (value !== null && typeof value === "object") {
    const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
    if (entries.length === 0 && prefix) out[prefix] = Array.isArray(value) ? "[]" : "{}";
    for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (prefix) {
    out[prefix] = value;
  }
  return out;
}

/** Inverse of flatten: numeric segments rebuild arrays. */
export function unflatten(flat: Flat): unknown {
  const root: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split(".");
    let node: Record<string, unknown> | unknown[] = root;
    keys.forEach((key, i) => {
      const last = i === keys.length - 1;
      const nextIsIndex = !last && /^\d+$/.test(keys[i + 1]);
      const container = node as Record<string, unknown>;
      if (last) {
        container[key] = value === "[]" ? [] : value === "{}" ? {} : value;
      } else {
        container[key] ??= nextIsIndex ? [] : {};
        node = container[key] as Record<string, unknown>;
      }
    });
  }
  return root;
}

export type Delimiter = "," | ";" | "\t" | "|";

export function jsonToCsv(json: string, delimiter: Delimiter = ","): ConvertResult {
  const parsed = parseJsonStrict(json);
  if (!parsed.ok) return parsed.result;
  const rows = Array.isArray(parsed.value) ? parsed.value : [parsed.value];
  if (rows.length === 0) return fail("The array is empty.");
  if (rows.some((r) => r === null || typeof r !== "object" || Array.isArray(r))) {
    return fail("Expected an object or an array of objects.");
  }
  const flat = rows.map((r) => flatten(r));
  const columns: string[] = [];
  for (const row of flat) for (const k of Object.keys(row)) if (!columns.includes(k)) columns.push(k);
  const data = flat.map((row) => columns.map((c) => (row[c] === null || row[c] === undefined ? "" : row[c])));
  return ok(Papa.unparse({ fields: columns, data }, { delimiter, newline: "\n" }));
}

/** CSV → JSON. Numbers, booleans and empty cells (null) are typed automatically. */
export function csvToJson(csv: string, delimiter: Delimiter | "auto" = "auto"): ConvertResult {
  const result = Papa.parse<Flat>(csv.trim(), {
    header: true,
    delimiter: delimiter === "auto" ? "" : delimiter,
    dynamicTyping: true,
    skipEmptyLines: true,
    transform: (v) => v,
  });
  const error = result.errors.find((e) => e.code !== "UndetectableDelimiter");
  if (error) return fail(error.message, error.row !== undefined ? error.row + 2 : undefined, 1);
  if (result.data.length === 0) return fail("No rows found.");
  const rows = result.data.map((row) =>
    unflatten(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === "" ? null : v]))),
  );
  return ok(JSON.stringify(rows, null, 2));
}
