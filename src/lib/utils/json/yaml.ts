import { parseAllDocuments, stringify } from "yaml";
import { attempt, fail, ok, type ConvertResult } from "../convert/result";
import { parseJsonStrict } from "./parse";

export function jsonToYaml(json: string, indent = 2): ConvertResult {
  const parsed = parseJsonStrict(json);
  if (!parsed.ok) return parsed.result;
  return attempt(() => ok(stringify(parsed.value, { indent, lineWidth: 0 })));
}

/**
 * YAML → JSON. Indentation and syntax errors come back with their position.
 * Several documents (`---`) become a JSON array.
 */
export function yamlToJson(yaml: string, indent = 2): ConvertResult {
  const docs = parseAllDocuments(yaml, { prettyErrors: true });
  const list = Array.isArray(docs) ? docs : [docs];
  for (const doc of list) {
    const error = doc.errors[0];
    if (error) {
      const pos = error.linePos?.[0];
      return fail(error.message.split("\n")[0], pos?.line, pos?.col);
    }
  }
  const values = list.map((d) => d.toJS({ maxAliasCount: 100 }) as unknown);
  const value = values.length === 1 ? values[0] : values;
  const warnings = list.flatMap((d) => d.warnings.map((w) => w.message.split("\n")[0]));
  return ok(JSON.stringify(value ?? null, null, indent), warnings);
}
