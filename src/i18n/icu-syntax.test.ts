import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";
import en from "./messages/en.json";
import es from "./messages/es.json";
import fr from "./messages/fr.json";
import pt from "./messages/pt.json";
import { toolMessageFiles } from "./tools";

type Tree = { [key: string]: string | Tree };

function strings(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [[`${prefix}${k}`, v] as [string, string]] : strings(v, `${prefix}${k}.`),
  );
}

const sources: [string, Tree][] = [
  ["en", en as Tree],
  ["es", es as Tree],
  ["fr", fr as Tree],
  ["pt", pt as Tree],
  ...Object.entries(toolMessageFiles).flatMap(([id, file]) =>
    Object.entries(file as Record<string, Tree>).map(([locale, tree]) => [`${id}/${locale}`, tree] as [string, Tree]),
  ),
];

/** Rich-text tags that components render with t.rich(). */
const ALLOWED_TAGS = new Set(["repo"]);

interface AstNode {
  type: number;
  value?: string;
  options?: Record<string, { value: AstNode[] }>;
  children?: AstNode[];
}

/** Returns problems: argument names that are not identifiers and unexpected <tags>. */
function problems(ast: AstNode[]): string[] {
  const out: string[] = [];
  for (const node of ast) {
    // 1 argument, 2 number, 3 date, 4 time, 5 select, 6 plural, 8 tag.
    if ([1, 2, 3, 4, 5, 6].includes(node.type) && !/^[A-Za-z_]\w*$/.test(node.value ?? "")) {
      out.push(`argument {${node.value}}`);
    }
    if (node.type === 8 && !ALLOWED_TAGS.has(node.value ?? "")) out.push(`tag <${node.value}>`);
    for (const option of Object.values(node.options ?? {})) out.push(...problems(option.value));
    if (node.children) out.push(...problems(node.children));
  }
  return out;
}

/**
 * Every message is ICU MessageFormat: a stray { } or <tag> breaks it at
 * runtime, often only while generating metadata at build time.
 */
describe.each(sources)("ICU syntax: %s", (_, tree) => {
  it("parses every message without accidental arguments or tags", () => {
    for (const [key, message] of strings(tree)) {
      let ast: AstNode[] = [];
      expect(() => {
        ast = new IntlMessageFormat(message, "en").getAst() as unknown as AstNode[];
      }, key).not.toThrow();
      expect(problems(ast), key).toEqual([]);
    }
  });
});

describe("ICU escaping", () => {
  it("renders quoted braces and angle brackets literally", () => {
    expect(new IntlMessageFormat("'{' \"a\": 1 '}' and '<'meta'>'", "en").format()).toBe('{ "a": 1 } and <meta>');
  });
});
