import { describe, expect, it } from "vitest";
import { toolIds } from "@/config/tools";
import { dataKinds } from "@/lib/utils/detect/detectors";
import { clientMessages, deepMerge, toolMessages, withToolMessages } from "./messages";
import en from "./messages/en.json";
import es from "./messages/es.json";
import fr from "./messages/fr.json";
import pt from "./messages/pt.json";
import { toolMessageFiles } from "./tools";

function keys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

const SEO_KEYS = ["name", "short", "title", "description", "h1", "lead"];

describe("shell messages", () => {
  const reference = keys(en).sort();

  it.each([
    ["es", es],
    ["fr", fr],
    ["pt", pt],
  ])("%s has exactly the same keys as en", (_, messages) => {
    expect(keys(messages).sort()).toEqual(reference);
  });

  it("names every detectable kind", () => {
    for (const kind of dataKinds) expect(reference).toContain(`kinds.${kind}`);
  });
});

describe.each(toolIds)("tool messages: %s", (id) => {
  const file = toolMessageFiles[id] as Record<string, object>;
  const enKeys = keys(file.en).sort();

  it("has the SEO keys in every language", () => {
    for (const locale of ["en", "es", "fr", "pt"]) {
      for (const k of SEO_KEYS) expect(keys(file[locale]), `${locale}.${k}`).toContain(k);
    }
  });

  it("es is complete", () => {
    expect(keys(file.es).sort()).toEqual(enKeys);
  });

  it("fr and pt only use keys that exist in en", () => {
    for (const locale of ["fr", "pt"]) {
      for (const k of keys(file[locale])) expect(enKeys, `${locale}: ${k}`).toContain(k);
    }
  });

  it("fr falls back to English for untranslated keys", () => {
    expect(keys(toolMessages(id, "fr")).sort()).toEqual(enKeys);
  });
});

describe("message helpers", () => {
  it("deep merges", () => {
    expect(deepMerge({ a: "1", b: { c: "2", d: "3" } }, { b: { c: "x" } })).toEqual({ a: "1", b: { c: "x", d: "3" } });
  });

  it("sends the client only the current tool in full", () => {
    const all = withToolMessages(en, "en");
    const client = clientMessages(all, "jwt-decoder") as Record<string, Record<string, Record<string, unknown>>>;
    expect(Object.keys(client.tools["json-format"])).toEqual(["name", "short"]);
    expect(client.tools["jwt-decoder"].placeholder).toBeDefined();
    expect(client.about).toBeUndefined();
  });
});
