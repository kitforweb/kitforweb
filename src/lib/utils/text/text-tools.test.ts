import { describe, expect, it } from "vitest";
import { convertCase, detectCase } from "./case";
import { collapse, computeDiff, unifiedPatch } from "./diff";
import { htmlToJsx, jsxAttributeName, styleToObject } from "./html-to-jsx";
import { combo, keyLabel, locationName, shortcutCondition, shortcutSnippet, type KeyInfo } from "./keyboard";
import { extractHeadings, htmlDocument, markdownStats, slugify, tableOfContents } from "./markdown";

describe("case converter", () => {
  it("converts between identifier styles", () => {
    expect(convertCase("user_first_name", "camel")).toBe("userFirstName");
    expect(convertCase("userFirstName", "snake")).toBe("user_first_name");
    expect(convertCase("user-first-name", "pascal")).toBe("UserFirstName");
    expect(convertCase("UserFirstName", "constant")).toBe("USER_FIRST_NAME");
    expect(convertCase("user first name", "kebab")).toBe("user-first-name");
    expect(convertCase("USER_FIRST_NAME", "title")).toBe("User First Name");
    expect(convertCase("userFirstName", "sentence")).toBe("User first name");
    expect(convertCase("userFirstName", "dot")).toBe("user.first.name");
    expect(convertCase("userFirstName", "path")).toBe("user/first/name");
    expect(convertCase("userFirstName", "train")).toBe("User-First-Name");
    expect(convertCase("userFirstName", "upper")).toBe("USER FIRST NAME");
  });

  it("handles acronyms, numbers and accents", () => {
    expect(convertCase("XMLHttpRequest", "snake")).toBe("xml_http_request");
    expect(convertCase("parseHTML5Doc", "kebab")).toBe("parse-html5-doc");
    expect(convertCase("año_fiscal", "camel")).toBe("añoFiscal");
  });

  it("converts each line and keeps empty lines and leading underscores", () => {
    expect(convertCase("first_name\n\nlastName", "kebab")).toBe("first-name\n\nlast-name");
    expect(convertCase("_private_field", "camel")).toBe("_privateField");
    expect(convertCase("", "camel")).toBe("");
  });

  it("detects the style of an identifier", () => {
    expect(detectCase("getUserName")).toBe("camel");
    expect(detectCase("UserService")).toBe("pascal");
    expect(detectCase("user_id")).toBe("snake");
    expect(detectCase("MAX_RETRIES")).toBe("constant");
    expect(detectCase("main-content")).toBe("kebab");
    expect(detectCase("Content-Type")).toBe("train");
    expect(detectCase("app.config.ts")).toBe("dot");
    expect(detectCase("hello world")).toBeNull();
    expect(detectCase("word")).toBeNull();
  });
});

describe("text diff", () => {
  it("pairs replaced lines and marks the changed words", () => {
    const r = computeDiff({ left: "const a = 1;\nconst b = 2;\n", right: "const a = 1;\nconst b = 3;\n" });
    expect(r).toMatchObject({ added: 1, removed: 1, identical: false });
    expect(r.rows[0].kind).toBe("equal");
    const row = r.rows[1];
    if (row.kind !== "replace") throw new Error(row.kind);
    expect(row.left.parts.filter((p) => p.changed).map((p) => p.text)).toEqual(["2"]);
    expect(row.right.parts.filter((p) => p.changed).map((p) => p.text)).toEqual(["3"]);
  });

  it("numbers insertions and deletions on their own side", () => {
    const r = computeDiff({ left: "a\nb\nc", right: "a\nc\nd" });
    expect(r.rows.map((row) => row.kind)).toEqual(["equal", "delete", "equal", "insert"]);
    const ins = r.rows[3];
    expect(ins.kind === "insert" && ins.right.n).toBe(3);
  });

  it("can ignore whitespace and case", () => {
    expect(computeDiff({ left: "a  b", right: "a b", ignoreWhitespace: true }).identical).toBe(true);
    expect(computeDiff({ left: "Hello", right: "hello", ignoreCase: true }).identical).toBe(true);
    expect(computeDiff({ left: "Hello", right: "hello" }).identical).toBe(false);
  });

  it("treats a missing final newline and CRLF as equal", () => {
    expect(computeDiff({ left: "a\r\nb", right: "a\nb\n" }).identical).toBe(true);
    expect(computeDiff({ left: "", right: "" }).identical).toBe(true);
  });

  it("collapses unchanged regions around the changes", () => {
    const left = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
    const right = left.replace("line 10", "line ten");
    const r = computeDiff({ left, right, context: 2 });
    expect(r.rows.map((row) => (row.kind === "skip" ? `skip ${row.count}` : row.kind))).toEqual([
      "skip 7",
      "equal",
      "equal",
      "replace",
      "equal",
      "equal",
      "skip 8",
    ]);
    expect(collapse([], 3)).toEqual([]);
  });

  it("produces a unified patch", () => {
    const patch = unifiedPatch("a\nb\n", "a\nc\n", ["old.txt", "new.txt"]);
    expect(patch).toContain("--- old.txt");
    expect(patch).toContain("+++ new.txt");
    expect(patch).toContain("-b\n+c");
  });
});

describe("HTML → JSX", () => {
  const jsx = (html: string, options = {}) => {
    const r = htmlToJsx(html, options);
    if (!r.ok) throw new Error(r.error);
    return r;
  };

  it("renames attributes and self-closes void elements", () => {
    expect(jsx('<label for="email" class="label">Email</label>').output).toBe(
      '<label htmlFor="email" className="label">Email</label>\n',
    );
    expect(jsx('<img src="a.png" alt="">').output).toBe('<img src="a.png" alt="" />\n');
    expect(jsx("<input type=checkbox checked disabled>").output).toBe('<input type="checkbox" checked disabled />\n');
  });

  it("converts inline styles to objects", () => {
    expect(styleToObject("color: red; margin-top: 4px; -webkit-transition: none; opacity: .5; z-index: 2")).toBe(
      '{ color: "red", marginTop: "4px", WebkitTransition: "none", opacity: ".5", zIndex: 2 }',
    );
    expect(styleToObject("background: url(data:image/png;base64,AAA=); --brand: #f00")).toBe(
      '{ background: "url(data:image/png;base64,AAA=)", "--brand": "#f00" }',
    );
    expect(styleToObject("")).toBe("{}");
  });

  it("maps SVG, aria, data and event attributes", () => {
    expect(jsxAttributeName("stroke-width")).toBe("strokeWidth");
    expect(jsxAttributeName("xlink:href")).toBe("xlinkHref");
    expect(jsxAttributeName("viewBox")).toBe("viewBox");
    expect(jsxAttributeName("aria-label")).toBe("aria-label");
    expect(jsxAttributeName("data-id")).toBe("data-id");
    expect(jsxAttributeName("onclick")).toBe("onClick");
    const r = jsx('<button onclick="save();">Save</button>');
    expect(r.output).toBe("<button onClick={() => { save() }}>Save</button>\n");
    expect(r.warnings).toEqual(["event-handlers"]);
  });

  it("escapes braces, keeps comments and wraps several roots in a fragment", () => {
    const out = jsx("<!-- header --><h1>Price {x}</h1><p>a &amp; b</p>").output;
    expect(out).toBe(
      ["<>", "  {/* header */}", '  <h1>Price {"{"}x{"}"}</h1>', "  <p>a &amp; b</p>", "</>", ""].join("\n"),
    );
  });

  it("keeps pre content and nests children with indentation", () => {
    expect(jsx("<ul><li>One</li><li>Two</li></ul>").output).toBe("<ul>\n  <li>One</li>\n  <li>Two</li>\n</ul>\n");
    expect(jsx("<pre>a\n  b</pre>").output).toBe('<pre>{"a\\n  b"}</pre>\n');
  });

  it("wraps in a component and uses uncontrolled props on demand", () => {
    const out = jsx('<input value="x"><textarea>hi</textarea>', { component: "Form", uncontrolled: true }).output;
    expect(out).toContain("export default function Form() {\n  return (\n    <>\n");
    expect(out).toContain('      <input defaultValue="x" />');
    expect(out).toContain('      <textarea defaultValue={"hi"} />');
  });

  it("drops the doctype, flags scripts and rejects empty input", () => {
    const r = jsx("<!DOCTYPE html><script>if (a < b) { go(`x`) }</script>");
    expect(r.output).toBe("<script>{`if (a < b) { go(\\`x\\`) }`}</script>\n");
    expect(r.warnings).toEqual(["script"]);
    expect(htmlToJsx("   ")).toEqual({ ok: false, error: "empty" });
  });
});

describe("keyboard", () => {
  const key = (over: Partial<KeyInfo>): KeyInfo => ({
    key: "a",
    code: "KeyA",
    keyCode: 65,
    location: 0,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    repeat: false,
    ...over,
  });

  it("builds the shortcut name", () => {
    expect(combo(key({ key: "K", code: "KeyK", ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+K");
    expect(combo(key({ key: "k", metaKey: true, altKey: true }), true)).toBe("Option+Cmd+K");
    expect(combo(key({ key: "Shift", shiftKey: true }))).toBe("Shift");
    expect(combo(key({ key: " ", code: "Space" }))).toBe("Space");
  });

  it("writes a layout-aware condition and snippet", () => {
    expect(shortcutCondition(key({ key: "S", ctrlKey: true, shiftKey: true }))).toBe(
      'event.key.toLowerCase() === "s" && event.ctrlKey && event.shiftKey',
    );
    expect(shortcutCondition(key({ key: "Escape", code: "Escape" }))).toBe('event.key === "Escape"');
    expect(shortcutCondition(key({ key: "1", code: "Digit1", altKey: true }))).toBe(
      'event.code === "Digit1" && event.altKey',
    );
    expect(shortcutCondition(key({ key: "Control", ctrlKey: true }))).toBe('event.key === "Control"');
    expect(shortcutSnippet(key({ key: "Enter", ctrlKey: true }))).toContain(
      'if (event.key === "Enter" && event.ctrlKey) {',
    );
  });

  it("names locations and labels", () => {
    expect(locationName(1)).toBe("left");
    expect(locationName(3)).toBe("numpad");
    expect(locationName(9)).toBe("standard");
    expect(keyLabel("a")).toBe("A");
    expect(keyLabel("ArrowUp")).toBe("ArrowUp");
  });
});

describe("markdown helpers", () => {
  const md =
    "# Project\n\nSome **text** with a [link](https://x.y).\n\n## Install\n\n```bash\n# not a heading\nnpm i\n```\n\n## Install\n\n### Usage & API\n";

  it("extracts headings with unique GitHub slugs, ignoring code", () => {
    expect(extractHeadings(md)).toEqual([
      { depth: 1, text: "Project", slug: "project" },
      { depth: 2, text: "Install", slug: "install" },
      { depth: 2, text: "Install", slug: "install-1" },
      { depth: 3, text: "Usage & API", slug: "usage--api" },
    ]);
    expect(slugify("¿Qué es? Ñandú")).toBe("qué-es-ñandú");
  });

  it("builds a table of contents without the title", () => {
    expect(tableOfContents(extractHeadings(md))).toBe(
      "- [Install](#install)\n- [Install](#install-1)\n  - [Usage & API](#usage--api)\n",
    );
    expect(tableOfContents([])).toBe("");
  });

  it("counts words outside code", () => {
    expect(markdownStats(md)).toMatchObject({ words: 10, readingMinutes: 1 });
    expect(markdownStats("")).toEqual({ words: 0, characters: 0, lines: 0, readingMinutes: 0 });
  });

  it("wraps HTML in a standalone document with an escaped title", () => {
    const doc = htmlDocument("<p>x</p>", "A <b> & C");
    expect(doc).toContain("<title>A &lt;b&gt; &amp; C</title>");
    expect(doc).toContain("<body>\n<p>x</p>\n</body>");
  });
});
