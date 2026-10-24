import { describe, expect, it } from "vitest";
import { formatValue, serialize } from "./console-bridge";
import {
  buildDocument,
  buildImportMap,
  esmUrl,
  importName,
  parseLibraryUrl,
  QUICK_LIBRARIES,
  usesImports,
  type PlaygroundSource,
} from "./document";

const SRC: PlaygroundSource = {
  html: '<h1 class="title">Hi</h1>',
  css: "h1 { color: red }",
  js: 'console.log("ready")',
  libraries: [],
  imports: [],
  module: false,
};

describe("console serialization", () => {
  it("serializes primitives like a browser console", () => {
    expect(formatValue(serialize("text"))).toBe("text");
    expect(formatValue(serialize(42))).toBe("42");
    expect(formatValue(serialize(undefined))).toBe("undefined");
    expect(formatValue(serialize(null))).toBe("null");
    expect(formatValue(serialize(10n))).toBe("10n");
    expect(formatValue(serialize(function save() {}))).toBe("ƒ save()");
  });

  it("serializes objects, arrays, maps, sets and dates", () => {
    expect(formatValue(serialize({ a: 1, b: ["x", true], "my-key": null }))).toBe(
      '{ a: 1, b: ["x", true], "my-key": null }',
    );
    expect(formatValue(serialize(new Map([["k", 1]])))).toBe("Map { k: 1 }");
    expect(formatValue(serialize(new Set([1, 2])))).toBe('Set { "0": 1, "1": 2 }');
    expect(formatValue(serialize(new Date(0)))).toBe("1970-01-01T00:00:00.000Z");
    expect(formatValue(serialize({}))).toBe("{}");
    class Point {
      x = 1;
    }
    expect(formatValue(serialize(new Point()))).toBe("Point { x: 1 }");
  });

  it("handles errors, cycles, depth and long arrays", () => {
    expect(formatValue(serialize(new TypeError("bad")))).toBe("TypeError: bad");
    const cyclic: Record<string, unknown> = { name: "a" };
    cyclic.self = cyclic;
    expect(formatValue(serialize(cyclic))).toBe('{ name: "a", self: [Circular] }');
    expect(formatValue(serialize({ a: { b: { c: { d: { e: 1 } } } } }))).toBe("{ a: { b: { c: { d: … } } } }");
    const long = serialize(Array.from({ length: 60 }, (_, i) => i));
    expect(long.t === "array" && long.more).toBe(10);
    expect(formatValue(long)).toMatch(/, …10 more\]$/);
  });

  it("produces data that survives structured cloning", () => {
    const s = serialize({ fn: () => 1, sym: Symbol("x"), err: new Error("e") });
    expect(structuredClone(s)).toEqual(s);
  });
});

describe("playground document", () => {
  it("puts the bridge first, then CSS, HTML and JS", () => {
    const doc = buildDocument(SRC, "run-1", "https://kitforweb.com");
    const bridge = doc.indexOf("kfw-playground");
    expect(bridge).toBeGreaterThan(0);
    expect(doc.indexOf("<style>")).toBeGreaterThan(bridge);
    expect(doc).toContain('"run-1", "https://kitforweb.com"');
    expect(doc).toContain('<body>\n<h1 class="title">Hi</h1>\n<script>\nconsole.log("ready")\n</script>');
  });

  it("injects self-contained bridge code that runs", () => {
    const doc = buildDocument(SRC, "r", "o");
    const code = /<script>\((function[\s\S]*?)\);<\/script>/.exec(doc)![1];
    // The injected text must be valid JavaScript on its own.
    expect(() => new Function(`return (${code})`)).not.toThrow();
  });

  it("adds libraries, an import map and module scripts", () => {
    const doc = buildDocument(
      {
        ...SRC,
        module: true,
        imports: ["react@18", "canvas-confetti"],
        libraries: QUICK_LIBRARIES.filter((l) => l.id === "pico" || l.id === "jquery"),
      },
      "r",
      "o",
    );
    expect(doc).toContain(
      '<script type="importmap">{"imports":{"react":"https://esm.sh/react@18","canvas-confetti":"https://esm.sh/canvas-confetti"}}</script>',
    );
    expect(doc).toContain(
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">',
    );
    expect(doc).toContain('<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>');
    expect(doc).toContain('<script type="module">');
  });

  it("does not let user code close its own script or style element", () => {
    const doc = buildDocument({ ...SRC, js: 'const s = "</script><b>x</b>";', css: "a{}</style><i>" }, "r", "o");
    expect(doc).toContain('const s = "<\\/script><b>x</b>";');
    expect(doc).toContain("a{}<\\/style><i>");
    expect(doc.match(/<\/script>/g)?.length).toBe(2);
  });

  it("omits empty sections", () => {
    const doc = buildDocument({ ...SRC, css: " ", js: "" }, "r", "o");
    expect(doc).not.toContain("<style>");
    expect(doc.match(/<script/g)?.length).toBe(1);
  });
});

describe("libraries and imports", () => {
  it("accepts https URLs from the supported CDNs", () => {
    expect(parseLibraryUrl("https://unpkg.com/htmx.org@2.0.3/dist/htmx.min.js")).toEqual({
      ok: true,
      library: {
        id: "https://unpkg.com/htmx.org@2.0.3/dist/htmx.min.js",
        name: "htmx.min.js",
        kind: "script",
        url: "https://unpkg.com/htmx.org@2.0.3/dist/htmx.min.js",
      },
    });
    const css = parseLibraryUrl("https://cdn.jsdelivr.net/npm/water.css@2/out/water.css");
    expect(css.ok && css.library.kind).toBe("style");
  });

  it("rejects other hosts, plain http and garbage", () => {
    expect(parseLibraryUrl("https://evil.example/x.js")).toEqual({ ok: false, error: "host" });
    expect(parseLibraryUrl("http://unpkg.com/x.js")).toEqual({ ok: false, error: "https" });
    expect(parseLibraryUrl("not a url")).toEqual({ ok: false, error: "url" });
  });

  it("maps package names to esm.sh", () => {
    expect(esmUrl("react")).toBe("https://esm.sh/react");
    expect(esmUrl("@vue/reactivity@3.5")).toBe("https://esm.sh/@vue/reactivity@3.5");
    expect(esmUrl("react-dom/client")).toBe("https://esm.sh/react-dom/client");
    expect(esmUrl("../etc/passwd")).toBeNull();
    expect(esmUrl("https://x.com/a")).toBeNull();
    expect(importName("react@18/jsx-runtime")).toBe("react/jsx-runtime");
    expect(importName("@scope/pkg@1.2.3")).toBe("@scope/pkg");
    expect(buildImportMap(["vue@3", "bad name"])).toEqual({ vue: "https://esm.sh/vue@3" });
  });

  it("detects static imports", () => {
    expect(usesImports('import confetti from "canvas-confetti";')).toBe(true);
    expect(usesImports("import './style.css';")).toBe(true);
    expect(usesImports("const x = await import('x')")).toBe(false);
    expect(usesImports("// important\nconsole.log(1)")).toBe(false);
  });
});
