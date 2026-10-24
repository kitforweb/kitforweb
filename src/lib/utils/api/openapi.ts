import { parseDocument } from "yaml";

export const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "trace"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface ApiParameter {
  name: string;
  in: string;
  required: boolean;
  description?: string;
  type?: string;
}

export interface ApiOperation {
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  operationId?: string;
  tags: string[];
  deprecated: boolean;
  parameters: ApiParameter[];
  requestBody?: { required: boolean; contentTypes: string[]; schema?: unknown };
  responses: { status: string; description?: string; schema?: unknown }[];
}

export interface SpecIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ApiDoc {
  version: "openapi-3" | "swagger-2";
  specVersion: string;
  title: string;
  apiVersion: string;
  description?: string;
  servers: string[];
  tags: { name: string; description?: string }[];
  operations: ApiOperation[];
  schemas: string[];
  issues: SpecIssue[];
}

export type ParseApiResult = { ok: true; doc: ApiDoc } | { ok: false; error: string; line?: number; column?: number };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Follows a local "#/components/schemas/X" reference. External refs are left as they are. */
export function resolveRef(root: Obj, ref: string): unknown {
  if (!ref.startsWith("#/")) return undefined;
  return ref
    .slice(2)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce<unknown>((node, key) => (isObj(node) ? node[key] : undefined), root);
}

/** Inlines local $refs up to `depth` levels; cycles become { $ref } so rendering always ends. */
export function deref(root: Obj, value: unknown, depth = 6, seen: string[] = []): unknown {
  if (Array.isArray(value)) return value.map((v) => deref(root, v, depth, seen));
  if (!isObj(value)) return value;
  if (typeof value.$ref === "string") {
    const ref = value.$ref;
    if (seen.includes(ref) || depth <= 0) return { $ref: ref };
    const target = resolveRef(root, ref);
    return target === undefined ? value : deref(root, target, depth - 1, [...seen, ref]);
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deref(root, v, depth, seen)]));
}

function collectRefs(value: unknown, out: Set<string>) {
  if (Array.isArray(value)) value.forEach((v) => collectRefs(v, out));
  else if (isObj(value)) {
    if (typeof value.$ref === "string") out.add(value.$ref);
    Object.values(value).forEach((v) => collectRefs(v, out));
  }
}

function schemaType(schema: unknown): string | undefined {
  if (!isObj(schema)) return undefined;
  if (typeof schema.$ref === "string") return schema.$ref.split("/").pop();
  if (schema.type === "array") return `${schemaType(schema.items) ?? "any"}[]`;
  return typeof schema.type === "string"
    ? schema.format
      ? `${schema.type} (${String(schema.format)})`
      : schema.type
    : undefined;
}

/** Parses an OpenAPI 3.x or Swagger 2.0 document (YAML or JSON) into a navigable model, with problems listed. */
export function parseOpenApi(text: string): ParseApiResult {
  const yamlDoc = parseDocument(text, { prettyErrors: true });
  const yamlError = yamlDoc.errors[0];
  if (yamlError)
    return {
      ok: false,
      error: yamlError.message.split("\n")[0],
      line: yamlError.linePos?.[0].line,
      column: yamlError.linePos?.[0].col,
    };
  const root = yamlDoc.toJS() as unknown;
  if (!isObj(root)) return { ok: false, error: "The document is not an object." };

  const issues: SpecIssue[] = [];
  const issue = (path: string, message: string, severity: SpecIssue["severity"] = "error") =>
    issues.push({ path, message, severity });

  const isV3 = typeof root.openapi === "string";
  const isV2 = root.swagger === "2.0" || root.swagger === 2;
  if (!isV3 && !isV2)
    return { ok: false, error: 'Missing "openapi: 3.x" or "swagger: 2.0" at the top of the document.' };
  if (isV3 && !/^3\.[01]\.\d+$/.test(String(root.openapi)))
    issue("openapi", `Unsupported version "${String(root.openapi)}"`, "warning");

  const info = isObj(root.info) ? root.info : {};
  if (!isObj(root.info)) issue("info", "The info object is required.");
  if (typeof info.title !== "string") issue("info.title", "info.title is required.");
  if (typeof info.version !== "string") issue("info.version", "info.version is required (as a string).");
  if (!isObj(root.paths)) issue("paths", "The paths object is required.");

  const servers = isV3
    ? (Array.isArray(root.servers) ? root.servers : []).filter(isObj).map((s) => String(s.url))
    : root.host
      ? [
          `${(Array.isArray(root.schemes) ? root.schemes[0] : "https") as string}://${String(root.host)}${String(root.basePath ?? "")}`,
        ]
      : [];

  const operations: ApiOperation[] = [];
  const operationIds = new Set<string>();
  for (const [path, item] of Object.entries(isObj(root.paths) ? root.paths : {})) {
    if (!path.startsWith("/")) issue(`paths.${path}`, "Paths must start with “/”.");
    if (!isObj(item)) continue;
    const shared = Array.isArray(item.parameters) ? item.parameters : [];
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!isObj(op)) continue;
      const where = `paths.${path}.${method}`;
      const params = [...shared, ...(Array.isArray(op.parameters) ? op.parameters : [])]
        .map((p) => (isObj(p) && typeof p.$ref === "string" ? resolveRef(root, p.$ref) : p))
        .filter(isObj);
      const parameters: ApiParameter[] = params.map((p) => ({
        name: String(p.name ?? "?"),
        in: String(p.in ?? "?"),
        required: Boolean(p.required) || p.in === "path",
        description: typeof p.description === "string" ? p.description : undefined,
        type: schemaType(isV3 ? p.schema : p),
      }));
      for (const name of path.match(/\{([^}]+)\}/g)?.map((m) => m.slice(1, -1)) ?? []) {
        if (!parameters.some((p) => p.in === "path" && p.name === name))
          issue(where, `Path parameter “${name}” is not declared.`);
      }
      if (typeof op.operationId === "string") {
        if (operationIds.has(op.operationId)) issue(where, `Duplicate operationId “${op.operationId}”.`);
        operationIds.add(op.operationId);
      }
      if (!isObj(op.responses) || Object.keys(op.responses).length === 0)
        issue(where, "Every operation needs at least one response.");

      let requestBody: ApiOperation["requestBody"];
      if (isV3 && isObj(op.requestBody)) {
        const rb = (
          typeof op.requestBody.$ref === "string" ? resolveRef(root, op.requestBody.$ref) : op.requestBody
        ) as Obj;
        const content = isObj(rb?.content) ? rb.content : {};
        const first = Object.values(content)[0];
        requestBody = {
          required: Boolean(rb?.required),
          contentTypes: Object.keys(content),
          schema: isObj(first) ? deref(root, first.schema) : undefined,
        };
      } else if (isV2) {
        const body = params.find((p) => p.in === "body");
        if (body)
          requestBody = {
            required: Boolean(body.required),
            contentTypes: ["application/json"],
            schema: deref(root, body.schema),
          };
      }

      const responses = Object.entries(isObj(op.responses) ? op.responses : {}).map(([status, r]) => {
        const res = (isObj(r) && typeof r.$ref === "string" ? resolveRef(root, r.$ref) : r) as Obj | undefined;
        const content = isV3 && isObj(res?.content) ? Object.values(res.content)[0] : undefined;
        const schema = isV3 ? (isObj(content) ? content.schema : undefined) : res?.schema;
        return {
          status,
          description: typeof res?.description === "string" ? res.description : undefined,
          schema: schema ? deref(root, schema) : undefined,
        };
      });

      operations.push({
        method,
        path,
        summary: typeof op.summary === "string" ? op.summary : undefined,
        description: typeof op.description === "string" ? op.description : undefined,
        operationId: typeof op.operationId === "string" ? op.operationId : undefined,
        tags: Array.isArray(op.tags) ? op.tags.map(String) : [],
        deprecated: op.deprecated === true,
        parameters: parameters.filter((p) => p.in !== "body"),
        requestBody,
        responses,
      });
    }
  }

  const refs = new Set<string>();
  collectRefs(root, refs);
  for (const ref of refs) {
    if (ref.startsWith("#/") && resolveRef(root, ref) === undefined) issue(ref, `Broken reference: ${ref}`);
  }

  const schemaHolder = isV3 ? (isObj(root.components) ? root.components.schemas : undefined) : root.definitions;
  return {
    ok: true,
    doc: {
      version: isV3 ? "openapi-3" : "swagger-2",
      specVersion: String(isV3 ? root.openapi : root.swagger),
      title: typeof info.title === "string" ? info.title : "Untitled API",
      apiVersion: typeof info.version === "string" ? info.version : "",
      description: typeof info.description === "string" ? info.description : undefined,
      servers,
      tags: (Array.isArray(root.tags) ? root.tags : []).filter(isObj).map((t) => ({
        name: String(t.name),
        description: typeof t.description === "string" ? t.description : undefined,
      })),
      operations,
      schemas: isObj(schemaHolder) ? Object.keys(schemaHolder) : [],
      issues,
    },
  };
}
