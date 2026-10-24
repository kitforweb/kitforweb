import { compileNode, type Quantifier, type RegexNode } from "./blocks";

export interface ExplainItem {
  depth: number;
  /** Regex fragment this item stands for. */
  source: string;
  node: RegexNode;
  /** For alternatives: index of the branch the following items belong to. */
  branch?: number;
}

/** Flattens the block tree into an indented list, part by part, for explanations. */
export function explain(nodes: RegexNode[], depth = 0): ExplainItem[] {
  const out: ExplainItem[] = [];
  for (const node of nodes) {
    out.push({ depth, source: compileNode(node), node });
    if (node.type === "group") out.push(...explain(node.children, depth + 1));
    if (node.type === "alt") {
      node.branches.forEach((branch, i) => {
        out.push({ depth: depth + 1, source: "", node, branch: i });
        out.push(...explain(branch, depth + 2));
      });
    }
  }
  return out;
}

export type QuantifierKind = "optional" | "oneOrMore" | "zeroOrMore" | "exactly" | "atLeast" | "between";

/** Classifies a quantifier so it can be described in words. */
export function describeQuantifier(
  q: Quantifier | undefined,
): { kind: QuantifierKind; min: number; max: number | null } | null {
  if (!q) return null;
  const { min, max } = q;
  if (min === 1 && max === 1) return null;
  if (min === 0 && max === 1) return { kind: "optional", min, max };
  if (min === 1 && max === null) return { kind: "oneOrMore", min, max };
  if (min === 0 && max === null) return { kind: "zeroOrMore", min, max };
  if (max === null) return { kind: "atLeast", min, max };
  if (min === max) return { kind: "exactly", min, max };
  return { kind: "between", min, max };
}
