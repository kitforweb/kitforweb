export type ExportTarget = "js" | "ts" | "html" | "zod" | "angular" | "python";

/** Escapes "/" so the source fits inside a /…/ literal. */
export function toLiteral(source: string, flags: string): string {
  return `/${source.replace(/(\\.)|\//g, (m, escaped: string | undefined) => escaped ?? "\\/")}/${flags}`;
}

/**
 * The HTML pattern attribute is implicitly anchored (^(?:…)$) and compiled
 * with the v flag, so leading ^ and trailing $ are redundant.
 */
export function toHtmlPattern(source: string): string {
  const stripped = source.replace(/^\^/, "").replace(/(?<!\\)\$$/, "");
  return stripped.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function exportRegex(source: string, flags: string, target: ExportTarget): string {
  const literal = toLiteral(source, flags);
  switch (target) {
    case "js":
      return `const pattern = ${literal};\n\npattern.test(value);`;
    case "ts":
      return `const pattern: RegExp = ${literal};\n\nexport const isValid = (value: string): boolean => pattern.test(value);`;
    case "html":
      return `<input type="text" pattern="${toHtmlPattern(source)}" required />`;
    case "zod":
      return `import * as z from "zod";\n\nexport const schema = z.string().regex(${literal}, "Invalid format");`;
    case "angular":
      return `import { Validators } from "@angular/forms";\n\ncontrol = new FormControl("", [Validators.pattern(${literal})]);`;
    case "python": {
      const pyFlags = [...flags]
        .map((f) => ({ i: "re.IGNORECASE", m: "re.MULTILINE", s: "re.DOTALL" })[f])
        .filter(Boolean);
      return `import re\n\npattern = re.compile(r"${source.replace(/"/g, '\\"')}"${pyFlags.length ? `, ${pyFlags.join(" | ")}` : ""})`;
    }
  }
}
