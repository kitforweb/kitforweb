import { InputData, jsonInputForTargetLanguage, quicktype } from "quicktype-core";
import { errorMessage, fail, ok, type ConvertResult } from "../convert/result";
import { parseJsonStrict } from "./parse";
import { toTypeName } from "./type-name";

export { toTypeName };

export type QuicktypeTarget = "typescript" | "typescript-zod";

export interface QuicktypeRequest {
  json: string;
  target: QuicktypeTarget;
  rootName: string;
  /** TypeScript only: `type X = {…}` instead of `interface X {…}`. */
  preferTypes?: boolean;
  readonly?: boolean;
}

/**
 * Infers types from a JSON sample with quicktype: optional fields (keys missing
 * in some objects of an array), nulls and arrays of mixed types become unions.
 */
export async function jsonToTypes(req: QuicktypeRequest): Promise<ConvertResult> {
  const parsed = parseJsonStrict(req.json);
  if (!parsed.ok) return parsed.result;
  if (parsed.value === null || typeof parsed.value !== "object") {
    return fail("The JSON sample must be an object or an array of objects.");
  }
  const name = toTypeName(req.rootName);
  try {
    const input = jsonInputForTargetLanguage(req.target);
    await input.addSource({ name, samples: [req.json] });
    const inputData = new InputData();
    inputData.addInput(input);
    const rendererOptions: Record<string, string> =
      req.target === "typescript"
        ? {
            "just-types": "true",
            "prefer-types": String(Boolean(req.preferTypes)),
            readonly: String(Boolean(req.readonly)),
            "prefer-unions": "true",
            "acronym-style": "original",
          }
        : {};
    const { lines } = await quicktype({ inputData, lang: req.target, rendererOptions, inferDateTimes: false });
    let output = lines.join("\n").trim();
    if (req.target === "typescript-zod" && Array.isArray(parsed.value)) {
      output += `\n\nexport const ${name}Schema = z.array(${name}ElementSchema);\nexport type ${name} = z.infer<typeof ${name}Schema>;`;
    }
    return ok(output + "\n");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
