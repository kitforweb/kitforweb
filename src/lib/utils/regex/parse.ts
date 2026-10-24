import regexpTree from "regexp-tree";
import { newId, type Quantifier, type RegexNode } from "./blocks";

// Minimal typing of the regexp-tree AST we rely on.
interface AstNode {
  type: string;
  [key: string]: unknown;
}

const META: Record<string, RegexNode["type"]> = { "\\d": "digit", "\\w": "word", "\\s": "space", ".": "any" };

function generate(node: AstNode): string {
  return regexpTree.generate(node as never);
}

function quantifierOf(q: AstNode): Quantifier {
  const greedy = q.greedy !== false;
  const lazy = greedy ? undefined : true;
  switch (q.kind) {
    case "*":
      return { min: 0, max: null, lazy };
    case "+":
      return { min: 1, max: null, lazy };
    case "?":
      return { min: 0, max: 1, lazy };
    default:
      // {n} has to === from; {n,} has no "to" at all.
      return { min: Number(q.from), max: q.to === undefined || q.to === null ? null : Number(q.to), lazy };
  }
}

function charValue(c: AstNode): string | null {
  return c.type === "Char" && (c.kind === "simple" || c.kind === "decimal" || c.kind === "hex" || c.kind === "unicode")
    ? String(c.symbol ?? c.value)
    : null;
}

function classSource(expressions: AstNode[]): string {
  return expressions
    .map((e) =>
      e.type === "ClassRange"
        ? `${String((e.from as AstNode).value)}-${String((e.to as AstNode).value)}`
        : String(e.value),
    )
    .join("");
}

/** A/a-z charset that is exactly [A-Za-z] becomes the "letter" block. */
function convertClass(node: AstNode): RegexNode {
  const exprs = (node.expressions as AstNode[]) ?? [];
  const chars = classSource(exprs);
  if (!node.negative && (chars === "A-Za-z" || chars === "a-zA-Z")) return { id: newId(), type: "letter" };
  return { id: newId(), type: "charset", chars, negate: Boolean(node.negative) };
}

function convert(node: AstNode): RegexNode[] {
  switch (node.type) {
    case "Alternative":
      return mergeLiterals((node.expressions as AstNode[]).flatMap(convert));
    case "Disjunction": {
      const branches: RegexNode[][] = [];
      const collect = (n: AstNode | null) => {
        if (n && n.type === "Disjunction") {
          collect(n.left as AstNode | null);
          collect(n.right as AstNode | null);
        } else branches.push(n ? convert(n) : []);
      };
      collect(node);
      return [{ id: newId(), type: "alt", branches }];
    }
    case "Char": {
      const meta = META[String(node.value)];
      if (node.kind === "meta" && meta) return [{ id: newId(), type: meta } as RegexNode];
      const v = charValue(node);
      return v !== null
        ? [{ id: newId(), type: "literal", value: v }]
        : [{ id: newId(), type: "raw", source: generate(node) }];
    }
    case "CharacterClass":
      return [convertClass(node)];
    case "Assertion":
      if (node.kind === "^") return [{ id: newId(), type: "start" }];
      if (node.kind === "$") return [{ id: newId(), type: "end" }];
      if (node.kind === "\\b") return [{ id: newId(), type: "boundary" }];
      return [{ id: newId(), type: "raw", source: generate(node) }];
    case "Group": {
      const inner = node.expression ? convert(node.expression as AstNode) : [];
      if (!node.capturing && inner.length === 1 && inner[0].type === "alt") return inner;
      return [
        {
          id: newId(),
          type: "group",
          children: inner,
          capture: Boolean(node.capturing),
          ...(node.name ? { name: String(node.name) } : {}),
        },
      ];
    }
    case "Repetition": {
      const inner = convert(node.expression as AstNode);
      const quantifier = quantifierOf(node.quantifier as AstNode);
      if (inner.length === 1) return [{ ...inner[0], quantifier }];
      return [{ id: newId(), type: "group", children: inner, capture: false, quantifier }];
    }
    default:
      return [{ id: newId(), type: "raw", source: generate(node) }];
  }
}

/** Consecutive unquantified one-character literals become one literal ("a","b","c" → "abc"). */
function mergeLiterals(nodes: RegexNode[]): RegexNode[] {
  const out: RegexNode[] = [];
  for (const n of nodes) {
    const prev = out[out.length - 1];
    if (n.type === "literal" && !n.quantifier && prev?.type === "literal" && !prev.quantifier) {
      prev.value += n.value;
    } else out.push(n);
  }
  return out;
}

export type ParseResult = { ok: true; nodes: RegexNode[]; flags: string } | { ok: false; error: string };

/** Regex source (or /source/flags) → visual blocks. */
export function parseRegex(input: string, flags = ""): ParseResult {
  const text = input.trim();
  if (!text) return { ok: true, nodes: [], flags };
  const literal = /^\/([\s\S]*)\/([dgimsuvy]*)$/.exec(text);
  const source = literal ? literal[1] : text;
  const usedFlags = literal ? literal[2] : flags;
  try {
    new RegExp(source, usedFlags.replace(/[^dgimsuy]/g, ""));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    const ast = regexpTree.parse(`/${source}/${usedFlags.replace(/[^gimsuy]/g, "")}`) as unknown as {
      body: AstNode | null;
    };
    return { ok: true, nodes: ast.body ? convert(ast.body) : [], flags: usedFlags };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
