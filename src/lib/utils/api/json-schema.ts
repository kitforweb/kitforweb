import Ajv, { type ErrorObject } from "ajv";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { findNodeAtLocation, parseTree } from "jsonc-parser";
import type { ConvertResult } from "../convert/result";
import { positionAt } from "../json/analyze";
import { parseJsonStrict } from "../json/parse";

export interface SchemaError {
  /** JSON Pointer of the failing value ("/user/email"), "" for the root. */
  pointer: string;
  /** Readable path ("user.email", "items[2]"). */
  path: string;
  keyword: string;
  message: string;
  /** Position of the failing value in the data, for highlighting. */
  offset?: number;
  length?: number;
  line?: number;
  column?: number;
}

export type ValidationResult =
  | { ok: true; valid: true }
  | { ok: true; valid: false; errors: SchemaError[] }
  | { ok: false; error: "data" | "schema"; message: string; line?: number; column?: number };

function pointerToPath(pointer: string): string {
  return pointer
    .split("/")
    .slice(1)
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce((acc, seg) => (/^\d+$/.test(seg) ? `${acc}[${seg}]` : acc ? `${acc}.${seg}` : seg), "");
}

function describe(e: ErrorObject): string {
  const p = e.params as Record<string, unknown>;
  switch (e.keyword) {
    case "required":
      return `missing required property “${String(p.missingProperty)}”`;
    case "additionalProperties":
      return `unexpected property “${String(p.additionalProperty)}”`;
    case "type":
      return `must be ${String(p.type)}`;
    case "enum":
      return `must be one of: ${(p.allowedValues as unknown[]).map((v) => JSON.stringify(v)).join(", ")}`;
    case "format":
      return `must be a valid ${String(p.format)}`;
    default:
      return e.message ?? e.keyword;
  }
}

/**
 * Validates JSON data against a JSON Schema (draft-07, 2019-09 or 2020-12,
 * picked from $schema) and points at the exact place of every error.
 */
export function validateJsonSchema(schemaText: string, dataText: string): ValidationResult {
  const parseFailure = (error: "data" | "schema", r: ConvertResult): ValidationResult =>
    r.ok ? { ok: false, error, message: "" } : { ok: false, error, message: r.error, line: r.line, column: r.column };
  const schema = parseJsonStrict(schemaText);
  if (!schema.ok) return parseFailure("schema", schema.result);
  const data = parseJsonStrict(dataText);
  if (!data.ok) return parseFailure("data", data.result);

  const s = schema.value as { $schema?: string };
  const AjvClass = typeof s?.$schema === "string" && /2020-12|2019-09/.test(s.$schema) ? Ajv2020 : Ajv;
  const ajv = new AjvClass({ allErrors: true, strict: false, verbose: false });
  addFormats(ajv);
  let validate: ReturnType<typeof ajv.compile>;
  try {
    validate = ajv.compile(schema.value as object);
  } catch (e) {
    return { ok: false, error: "schema", message: e instanceof Error ? e.message : String(e) };
  }
  if (validate(data.value)) return { ok: true, valid: true };

  const tree = parseTree(dataText);
  const errors = (validate.errors ?? []).map((e): SchemaError => {
    const pointer = e.instancePath;
    const segments = pointer
      .split("/")
      .slice(1)
      .map((seg) => (/^\d+$/.test(seg) ? Number(seg) : seg.replace(/~1/g, "/").replace(/~0/g, "~")));
    const node = tree ? findNodeAtLocation(tree, segments) : undefined;
    const target = node?.parent?.type === "property" ? node.parent : node;
    const pos = target ? positionAt(dataText, target.offset) : undefined;
    return {
      pointer,
      path: pointerToPath(pointer) || "(root)",
      keyword: e.keyword,
      message: describe(e),
      ...(target && pos ? { offset: target.offset, length: target.length, ...pos } : {}),
    };
  });
  return { ok: true, valid: false, errors };
}

type JsonSchema = Record<string, unknown>;

const FORMATS: [RegExp, string][] = [
  [/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/, "date-time"],
  [/^\d{4}-\d{2}-\d{2}$/, "date"],
  [/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "email"],
  [/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "uuid"],
  [/^https?:\/\/\S+$/, "uri"],
];

function merge(a: JsonSchema, b: JsonSchema): JsonSchema {
  if (JSON.stringify(a) === JSON.stringify(b)) return a;
  if (a.type === "object" && b.type === "object") {
    const pa = (a.properties ?? {}) as Record<string, JsonSchema>;
    const pb = (b.properties ?? {}) as Record<string, JsonSchema>;
    const properties: Record<string, JsonSchema> = { ...pa };
    for (const [k, v] of Object.entries(pb)) properties[k] = k in pa ? merge(pa[k], v) : v;
    const required = ((a.required ?? []) as string[]).filter((k) => ((b.required ?? []) as string[]).includes(k));
    return { type: "object", properties, ...(required.length ? { required } : {}) };
  }
  if (a.type === b.type && a.type !== "array") {
    const { format: fa, ...ra } = a;
    return fa === b.format ? a : ra;
  }
  const types = [...new Set([a.type, b.type].flat())].filter(Boolean);
  return { type: types };
}

export function inferSchema(value: unknown): JsonSchema {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    const items = value.map(inferSchema).reduce<JsonSchema | null>((acc, s) => (acc ? merge(acc, s) : s), null);
    return { type: "array", ...(items ? { items } : {}) };
  }
  switch (typeof value) {
    case "string": {
      const format = FORMATS.find(([re]) => re.test(value))?.[1];
      return { type: "string", ...(format ? { format } : {}) };
    }
    case "number":
      return { type: Number.isInteger(value) ? "integer" : "number" };
    case "boolean":
      return { type: "boolean" };
    default: {
      const obj = value as Record<string, unknown>;
      const properties = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, inferSchema(v)]));
      const required = Object.keys(obj);
      return { type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false };
    }
  }
}

/** JSON Schema (draft 2020-12) generated from an example document. */
export function generateSchema(dataText: string): { ok: true; schema: string } | { ok: false; message: string } {
  const parsed = parseJsonStrict(dataText);
  if (!parsed.ok) return { ok: false, message: !parsed.result.ok ? parsed.result.error : "" };
  const schema = { $schema: "https://json-schema.org/draft/2020-12/schema", ...inferSchema(parsed.value) };
  return { ok: true, schema: JSON.stringify(schema, null, 2) };
}
