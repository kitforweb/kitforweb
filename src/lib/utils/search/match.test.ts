import { describe, expect, it } from "vitest";
import { matchesQuery, matchRank, normalize } from "./match";

describe("search matching", () => {
  it("ignores case and accents", () => {
    expect(normalize("Décodeur JWT")).toBe("decodeur jwt");
    expect(matchesQuery("decodeur", ["Décodeur JWT"])).toBe(true);
  });

  it("requires every word, in any field", () => {
    expect(matchesQuery("json min", ["Formatear JSON", "minify"])).toBe(true);
    expect(matchesQuery("json yaml", ["Formatear JSON", "minify"])).toBe(false);
  });

  it("matches everything with an empty query", () => {
    expect(matchesQuery("  ", ["x"])).toBe(true);
  });
});

describe("matchRank", () => {
  it("ranks a name prefix above a name match above a keyword match", () => {
    expect(matchRank("mermaid", "Mermaid Editor")).toBe(0);
    expect(matchRank("editor", "Mermaid Editor")).toBe(1);
    expect(matchRank("mermaid", "SQL → ER diagram")).toBe(2);
  });

  it("ignores accents and treats an empty query as no preference", () => {
    expect(matchRank("codigos", "Códigos HTTP")).toBe(0);
    expect(matchRank("", "Anything")).toBe(2);
  });
});
