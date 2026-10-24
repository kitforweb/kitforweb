/**
 * Visual regex blocks. A pattern is a list of nodes; groups and alternatives
 * contain nested lists. Every node can carry a quantifier ("repeat 2 to 4").
 */
export interface Quantifier {
  min: number;
  /** null = unlimited. */
  max: number | null;
  lazy?: boolean;
}

interface Base {
  id: string;
  quantifier?: Quantifier;
}

export type RegexNode =
  | (Base & { type: "start" | "end" | "boundary" | "digit" | "letter" | "word" | "space" | "any" })
  | (Base & { type: "literal"; value: string })
  | (Base & { type: "charset"; chars: string; negate: boolean })
  | (Base & { type: "group"; children: RegexNode[]; capture: boolean; name?: string })
  | (Base & { type: "alt"; branches: RegexNode[][] })
  /** Anything the visual builder cannot represent (lookarounds, back-references…), kept verbatim. */
  | (Base & { type: "raw"; source: string });

export type NodeType = RegexNode["type"];

export const ATOMS: NodeType[] = ["start", "end", "boundary", "digit", "letter", "word", "space", "any"];

let counter = 0;
export const newId = () => `n${Date.now().toString(36)}${(counter++).toString(36)}`;

/** A fresh node of the given type with sensible defaults (used by the palette). */
export function createNode(type: NodeType): RegexNode {
  const id = newId();
  switch (type) {
    case "literal":
      return { id, type, value: "abc" };
    case "charset":
      return { id, type, chars: "a-z", negate: false };
    case "group":
      return { id, type, children: [], capture: true };
    case "alt":
      return { id, type, branches: [[], []] };
    case "raw":
      return { id, type, source: "" };
    default:
      return { id, type };
  }
}

const ESCAPE = /[.*+?^${}()|[\]\\/]/g;
export const escapeLiteral = (s: string) => s.replace(ESCAPE, "\\$&");

export function quantifierSource(q: Quantifier | undefined): string {
  if (!q) return "";
  const { min, max, lazy } = q;
  let s: string;
  if (min === 0 && max === 1) s = "?";
  else if (min === 0 && max === null) s = "*";
  else if (min === 1 && max === null) s = "+";
  else if (max === null) s = `{${min},}`;
  else if (min === max) s = min === 1 ? "" : `{${min}}`;
  else s = `{${min},${max}}`;
  return s && lazy ? `${s}?` : s;
}

/** True when a quantifier applies to the whole source without wrapping it. */
function isAtomic(node: RegexNode, source: string): boolean {
  if (node.type === "literal") return [...node.value].length === 1;
  if (node.type === "raw") return /^(\\.|\[[^\]]*\]|\((?:[^()]|\\.)*\)|.)$/u.test(source);
  return node.type !== "alt";
}

export function compileNode(node: RegexNode): string {
  let s: string;
  switch (node.type) {
    case "start":
      s = "^";
      break;
    case "end":
      s = "$";
      break;
    case "boundary":
      s = "\\b";
      break;
    case "digit":
      s = "\\d";
      break;
    case "letter":
      s = "[A-Za-z]";
      break;
    case "word":
      s = "\\w";
      break;
    case "space":
      s = "\\s";
      break;
    case "any":
      s = ".";
      break;
    case "literal":
      s = escapeLiteral(node.value);
      break;
    case "charset":
      // `chars` is the class content in regex syntax ("a-z0-9_", "\d.-").
      s = `[${node.negate ? "^" : ""}${node.chars}]`;
      break;
    case "group":
      s = `(${node.capture ? (node.name ? `?<${node.name}>` : "") : "?:"}${compile(node.children)})`;
      break;
    case "alt":
      s = node.branches.map(compile).join("|");
      break;
    case "raw":
      s = node.source;
      break;
  }
  const q = quantifierSource(node.quantifier);
  if (!q) return node.type === "alt" ? `(?:${s})` : s;
  return isAtomic(node, s) ? s + q : `(?:${s})${q}`;
}

/** Regex source for a list of nodes. A top-level alternative needs no extra group. */
export function compile(nodes: RegexNode[]): string {
  if (nodes.length === 1 && nodes[0].type === "alt" && !nodes[0].quantifier) {
    return nodes[0].branches.map(compile).join("|");
  }
  return nodes.map(compileNode).join("");
}

// ---- tree helpers (pure, used by the builder's reducer) ----

export type Path = (string | number)[];

/** Container address: [] = root, [groupId] = group children, [altId, branchIndex] = branch. */
export function getContainer(nodes: RegexNode[], path: Path): RegexNode[] | null {
  if (path.length === 0) return nodes;
  const [id, branch] = path;
  const node = findNode(nodes, String(id));
  if (!node) return null;
  if (node.type === "group") return node.children;
  if (node.type === "alt" && typeof branch === "number") return node.branches[branch] ?? null;
  return null;
}

export function findNode(nodes: RegexNode[], id: string): RegexNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const children = n.type === "group" ? [n.children] : n.type === "alt" ? n.branches : [];
    for (const list of children) {
      const found = findNode(list, id);
      if (found) return found;
    }
  }
  return null;
}

/** Returns a deep copy where `fn` may mutate the copy freely. */
export function produce(nodes: RegexNode[], fn: (draft: RegexNode[]) => void): RegexNode[] {
  const draft = structuredClone(nodes);
  fn(draft);
  return draft;
}

/** Path of the container that holds `id`, and its index there. */
export function locate(nodes: RegexNode[], id: string, path: Path = []): { path: Path; index: number } | null {
  const index = nodes.findIndex((n) => n.id === id);
  if (index >= 0) return { path, index };
  for (const n of nodes) {
    if (n.type === "group") {
      const r = locate(n.children, id, [n.id]);
      if (r) return r;
    }
    if (n.type === "alt") {
      for (let b = 0; b < n.branches.length; b++) {
        const r = locate(n.branches[b], id, [n.id, b]);
        if (r) return r;
      }
    }
  }
  return null;
}

/** True when `id` is `ancestorId` or lives inside it (a block cannot be dropped into itself). */
export function isInside(nodes: RegexNode[], ancestorId: string, id: string): boolean {
  if (ancestorId === id) return true;
  const ancestor = findNode(nodes, ancestorId);
  if (!ancestor) return false;
  const lists = ancestor.type === "group" ? [ancestor.children] : ancestor.type === "alt" ? ancestor.branches : [];
  return lists.some((l) => findNode(l, id) !== null);
}

export function insertAt(nodes: RegexNode[], path: Path, index: number, node: RegexNode): RegexNode[] {
  return produce(nodes, (draft) => {
    const list = getContainer(draft, path);
    if (list) list.splice(Math.max(0, Math.min(index, list.length)), 0, node);
  });
}

export function removeNode(nodes: RegexNode[], id: string): RegexNode[] {
  return produce(nodes, (draft) => {
    const loc = locate(draft, id);
    if (loc) getContainer(draft, loc.path)?.splice(loc.index, 1);
  });
}

export function moveNode(nodes: RegexNode[], id: string, path: Path, index: number): RegexNode[] {
  const [first] = path;
  if (first !== undefined && isInside(nodes, id, String(first))) return nodes;
  const loc = locate(nodes, id);
  const node = findNode(nodes, id);
  if (!loc || !node) return nodes;
  const sameContainer = JSON.stringify(loc.path) === JSON.stringify(path);
  const without = removeNode(nodes, id);
  const target = sameContainer && loc.index < index ? index - 1 : index;
  return insertAt(without, path, target, structuredClone(node));
}

export function updateNode(nodes: RegexNode[], id: string, patch: Partial<RegexNode>): RegexNode[] {
  return produce(nodes, (draft) => {
    const n = findNode(draft, id);
    if (n) Object.assign(n, patch);
  });
}
