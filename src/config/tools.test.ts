import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dataKinds } from "@/lib/utils/detect/detectors";
import { locales, toolIds, tools } from "./tools";

describe("tool registry", () => {
  it("lists every id once, in menu order", () => {
    expect(tools.map((t) => t.id)).toEqual([...toolIds]);
  });

  it("has unique, URL-safe slugs per locale", () => {
    for (const locale of locales) {
      const slugs = tools.map((t) => t.slugs[locale]);
      expect(new Set(slugs).size, locale).toBe(slugs.length);
      for (const slug of slugs) {
        expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(slug).not.toBe("about");
      }
    }
  });

  it("keeps blocks contiguous and in order", () => {
    const groups = tools.map((t) => t.group);
    expect([...groups].sort((a, b) => a - b)).toEqual(groups);
  });

  it("only detects known kinds, and each kind opens a single tool", () => {
    const seen = new Set<string>();
    for (const tool of tools) {
      for (const kind of tool.detects) {
        expect(dataKinds).toContain(kind);
        expect(seen.has(kind), kind).toBe(false);
        seen.add(kind);
      }
    }
  });

  it("never makes a sensitive tool shareable", () => {
    for (const tool of tools) if (tool.sensitive) expect(tool.shareable, tool.id).toBe(false);
  });

  it.each(toolIds)("%s has SEO content in English and Spanish", (id) => {
    for (const locale of ["en", "es"]) {
      expect(existsSync(join(process.cwd(), "src/content", id, `${locale}.mdx`)), `${id}/${locale}.mdx`).toBe(true);
    }
  });
});
