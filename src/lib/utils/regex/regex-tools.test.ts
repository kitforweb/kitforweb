import { describe, expect, it } from "vitest";
import {
  compile,
  createNode,
  findNode,
  insertAt,
  isInside,
  locate,
  moveNode,
  quantifierSource,
  removeNode,
  updateNode,
  type RegexNode,
} from "./blocks";
import { describeQuantifier, explain } from "./explain";
import { exportRegex, toHtmlPattern, toLiteral } from "./export";
import { libraryPatterns } from "./library";
import { parseRegex } from "./parse";
import { normalizeFlags, runRegexTest, segments } from "./tester";

const n = (node: Record<string, unknown>) => ({ id: Math.random().toString(36), ...node }) as RegexNode;

describe("compile", () => {
  it("builds a regex from blocks", () => {
    const nodes: RegexNode[] = [
      n({ type: "start" }),
      n({ type: "literal", value: "a.b" }),
      n({ type: "digit", quantifier: { min: 2, max: 4 } }),
      n({ type: "charset", chars: "a-z_", negate: false, quantifier: { min: 1, max: null } }),
      n({ type: "group", capture: true, name: "ext", children: [n({ type: "literal", value: "x" })] }),
      n({ type: "end" }),
    ];
    expect(compile(nodes)).toBe("^a\\.b\\d{2,4}[a-z_]+(?<ext>x)$");
  });

  it("wraps multi-character literals and alternatives that carry a quantifier", () => {
    expect(compile([n({ type: "literal", value: "ab", quantifier: { min: 0, max: 1 } })])).toBe("(?:ab)?");
    const alt = n({
      type: "alt",
      branches: [[n({ type: "literal", value: "com" })], [n({ type: "literal", value: "es" })]],
    });
    expect(compile([alt])).toBe("com|es");
    expect(compile([n({ type: "literal", value: "." }), alt])).toBe("\\.(?:com|es)");
  });

  it("writes every quantifier form", () => {
    expect(quantifierSource({ min: 0, max: 1 })).toBe("?");
    expect(quantifierSource({ min: 0, max: null })).toBe("*");
    expect(quantifierSource({ min: 1, max: null, lazy: true })).toBe("+?");
    expect(quantifierSource({ min: 3, max: 3 })).toBe("{3}");
    expect(quantifierSource({ min: 2, max: null })).toBe("{2,}");
    expect(quantifierSource({ min: 1, max: 1 })).toBe("");
  });

  it("creates palette nodes with defaults", () => {
    expect(createNode("charset")).toMatchObject({ type: "charset", chars: "a-z", negate: false });
    expect(createNode("alt")).toMatchObject({ type: "alt", branches: [[], []] });
  });
});

describe("parseRegex (regex → blocks)", () => {
  it.each([
    "^[\\w.+-]+@[\\w-]+\\.[A-Za-z]{2,}$",
    "^(?<year>\\d{4})-(?:0[1-9]|1[0-2])$",
    "colou?r",
    "a|b|c",
    "\\bcat\\b",
    "[^0-9]+?",
    "(?=.*\\d).{8,}",
    "(ab)\\1",
  ])("round-trips %s", (source) => {
    const r = parseRegex(source);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = compile(r.nodes);
    // Same language: compare behaviour on a few samples.
    for (const s of ["", "a", "abc", "color", "colour", "2024-05", "ada@example.com", "x cat y", "Passw0rd!", "abab"]) {
      expect(new RegExp(out).test(s), `${source} vs ${out} on "${s}"`).toBe(new RegExp(source).test(s));
    }
  });

  it("maps common constructs to friendly blocks", () => {
    const r = parseRegex("/^[A-Za-z]\\d+\\s.$/i");
    expect(r.ok && r.flags).toBe("i");
    expect(r.ok && r.nodes.map((x) => x.type)).toEqual(["start", "letter", "digit", "space", "any", "end"]);
    expect(r.ok && r.nodes[2].quantifier).toEqual({ min: 1, max: null });
  });

  it("merges consecutive characters into one literal and keeps unsupported parts raw", () => {
    const r = parseRegex("abc(?<=x)");
    expect(r.ok && r.nodes).toEqual([
      expect.objectContaining({ type: "literal", value: "abc" }),
      expect.objectContaining({ type: "raw", source: "(?<=x)" }),
    ]);
  });

  it("reports invalid regexes and accepts the empty string", () => {
    expect(parseRegex("a(b")).toMatchObject({ ok: false });
    expect(parseRegex("[z-a]")).toMatchObject({ ok: false });
    expect(parseRegex("  ")).toEqual({ ok: true, nodes: [], flags: "" });
  });
});

describe("block tree operations", () => {
  const tree = (): RegexNode[] => [
    n({ id: "a", type: "literal", value: "a" }),
    n({ id: "g", type: "group", capture: true, children: [n({ id: "b", type: "digit" })] }),
    n({ id: "o", type: "alt", branches: [[n({ id: "c", type: "any" })], []] }),
  ];

  it("locates nodes in nested containers", () => {
    expect(locate(tree(), "b")).toEqual({ path: ["g"], index: 0 });
    expect(locate(tree(), "c")).toEqual({ path: ["o", 0], index: 0 });
    expect(findNode(tree(), "zzz")).toBeNull();
  });

  it("inserts, moves, updates and removes immutably", () => {
    const t = tree();
    const inserted = insertAt(t, ["o", 1], 0, n({ id: "d", type: "word" }));
    expect(compile(inserted)).toBe("a(\\d)(?:.|\\w)");
    expect(compile(t)).toBe("a(\\d)(?:.|)");
    const moved = moveNode(t, "a", ["g"], 1);
    expect(compile(moved)).toBe("(\\da)(?:.|)");
    const reordered = moveNode(t, "a", [], 3);
    expect(reordered.map((x) => x.id)).toEqual(["g", "o", "a"]);
    expect(compile(updateNode(t, "b", { quantifier: { min: 3, max: 3 } }))).toBe("a(\\d{3})(?:.|)");
    expect(compile(removeNode(t, "g"))).toBe("a(?:.|)");
  });

  it("refuses to drop a group inside itself", () => {
    const t = tree();
    expect(isInside(t, "g", "b")).toBe(true);
    expect(moveNode(t, "g", ["g"], 0)).toBe(t);
  });
});

describe("explain", () => {
  it("flattens the tree with depth and fragments", () => {
    const r = parseRegex("^(\\d{3})|x");
    if (!r.ok) throw new Error();
    const items = explain(r.nodes);
    expect(items[0]).toMatchObject({ depth: 0, source: "(?:^(\\d{3})|x)" });
    expect(items.some((i) => i.source === "\\d{3}" && i.depth === 3)).toBe(true);
  });

  it("classifies quantifiers", () => {
    expect(describeQuantifier({ min: 2, max: 4 })).toEqual({ kind: "between", min: 2, max: 4 });
    expect(describeQuantifier({ min: 0, max: 1 })?.kind).toBe("optional");
    expect(describeQuantifier(undefined)).toBeNull();
  });
});

describe("export", () => {
  it("escapes slashes for literals and strips anchors for HTML", () => {
    expect(toLiteral("a/b\\/c", "gi")).toBe("/a\\/b\\/c/gi");
    expect(toHtmlPattern('^[a-z]+"$')).toBe("[a-z]+&quot;");
    expect(toHtmlPattern("price\\$")).toBe("price\\$");
  });

  it("produces snippets for every target", () => {
    expect(exportRegex("^\\d+$", "", "zod")).toContain("z.string().regex(/^\\d+$/");
    expect(exportRegex("^\\d+$", "", "angular")).toContain("Validators.pattern(/^\\d+$/)");
    expect(exportRegex("^\\d+$", "", "html")).toContain('pattern="\\d+"');
    expect(exportRegex("a", "im", "python")).toContain("re.IGNORECASE | re.MULTILINE");
    expect(exportRegex("a", "", "ts")).toContain("const pattern: RegExp = /a/;");
  });
});

describe("tester", () => {
  it("tests every line and collects groups", () => {
    const r = runRegexTest({ source: "(\\d{4})-(?<m>\\d{2})", flags: "", text: "2024-05\nnope", mode: "lines" });
    if (!r.ok) throw new Error();
    expect(r.lines.map((l) => l.matched)).toEqual([true, false]);
    expect(r.lines[0].matches[0]).toMatchObject({ text: "2024-05", groups: ["2024", "05"], named: { m: "05" } });
  });

  it("finds all matches with g and survives empty matches", () => {
    const r = runRegexTest({ source: "a*", flags: "g", text: "baab", mode: "text" });
    expect(r.ok && r.lines[0].matches.map((m) => m.text)).toEqual(["", "aa", "", ""]);
  });

  it("splits lines into highlighted segments", () => {
    expect(
      segments("a1b22", [
        { index: 1, end: 2, text: "1", groups: [] },
        { index: 3, end: 5, text: "22", groups: [] },
      ]),
    ).toEqual([
      { text: "a", match: false },
      { text: "1", match: true },
      { text: "b", match: false },
      { text: "22", match: true },
    ]);
  });

  it("reports invalid patterns and cleans flags", () => {
    expect(runRegexTest({ source: "(", flags: "", text: "", mode: "lines" })).toMatchObject({ ok: false });
    expect(normalizeFlags("ggiqx")).toBe("gi");
  });
});

describe("library patterns", () => {
  it.each(libraryPatterns.map((p) => [p.id, p] as const))(
    "%s accepts its valid examples and rejects the invalid ones",
    (_, p) => {
      const re = new RegExp(p.source, p.flags);
      for (const v of p.valid) expect(re.test(v), `${p.id} should accept "${v}"`).toBe(true);
      for (const v of p.invalid) expect(re.test(v), `${p.id} should reject "${v}"`).toBe(false);
    },
  );

  it("every pattern can be opened in the builder", () => {
    for (const p of libraryPatterns) expect(parseRegex(p.source, p.flags).ok, p.id).toBe(true);
  });
});
