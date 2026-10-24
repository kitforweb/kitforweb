import { describe, expect, it } from "vitest";
import { detectAll, detectHtml, detectIdentifier, detectMarkdown } from "./detectors";
import { resolveDetections } from "./resolve";

const TOOLS: Record<string, string> = {
  markdown: "markdown",
  html: "html-to-jsx",
  identifier: "case-converter",
  yaml: "json-yaml",
  uuid: "uuid",
  "http-headers": "http-headers",
};
const resolve = (input: string) => resolveDetections(input, (k) => TOOLS[k]);

const README = `# my-lib

Tiny helper for **dates**.

## Install

\`\`\`bash
npm i my-lib
\`\`\`

- [x] ESM
- [ ] CJS

See [the docs](https://example.com).`;

describe("detectMarkdown", () => {
  it("opens the Markdown editor for a README", () => {
    expect(detectMarkdown(README)?.confidence).toBeGreaterThanOrEqual(0.85);
    expect(resolve(README).auto?.toolId).toBe("markdown");
  });

  it("is a weak guess with only two constructs", () => {
    expect(detectMarkdown("# Title\n\n- one\n- two")?.confidence).toBe(0.6);
  });

  it.each(["just a line", "# only a heading\nand text", '{"a": "# b\\n- c"}', "<h1>x</h1>\n<ul><li>a</li></ul>"])(
    "ignores %#",
    (input) => {
      expect(detectMarkdown(input)).toBeNull();
    },
  );

  it("does not take a YAML list with comments as Markdown", () => {
    const yaml = "# servers\nhosts:\n  - a.example.com\n  - b.example.com\nport: 22";
    expect(resolve(yaml).auto?.toolId).not.toBe("markdown");
  });
});

describe("HTML → JSX", () => {
  it("opens HTML snippets in the JSX converter", () => {
    expect(resolve('<div class="card"><img src="a.png"></div>').auto?.toolId).toBe("html-to-jsx");
    expect(detectHtml("<!doctype html><html></html>")?.confidence).toBeGreaterThan(0.9);
  });
});

describe("detectIdentifier", () => {
  it.each(["getUserName", "UserService", "user_id", "MAX_RETRIES", "main-content", "Content-Type"])(
    "detects %s",
    (input) => {
      expect(detectIdentifier(input)?.kind).toBe("identifier");
    },
  );

  it("is only a suggestion, never opened automatically", () => {
    const r = resolve("user_first_name");
    expect(r.auto).toBeNull();
    expect(r.candidates.map((c) => c.toolId)).toContain("case-converter");
  });

  it.each(["example.com", "hello world", "word", "550e8400-e29b-41d4-a716-446655440000x y", ""])(
    "ignores %s",
    (input) => {
      expect(detectIdentifier(input)).toBeNull();
    },
  );

  it("lets a UUID win over the kebab-case reading", () => {
    expect(resolve("550e8400-e29b-41d4-a716-446655440000").auto?.toolId).toBe("uuid");
    expect(detectAll("550e8400-e29b-41d4-a716-446655440000").map((d) => d.kind)).toContain("uuid");
  });
});
