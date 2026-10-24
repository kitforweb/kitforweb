import { describe, expect, it } from "vitest";
import { csvToJson, flatten, jsonToCsv, unflatten } from "./csv";
import { diffJson, joinPath, summarize } from "./diff";
import { generateMock, mergeTemplate } from "./mock";
import { jsonToTypes, toTypeName } from "./quicktype";
import { jsonToYaml, yamlToJson } from "./yaml";

const out = (r: { ok: boolean; output?: string }) => (r.ok ? (r as { output: string }).output : "");

describe("JSON → TypeScript / Zod (quicktype)", () => {
  it("normalises the root type name", () => {
    expect(toTypeName("my root-type")).toBe("MyRootType");
    expect(toTypeName("  ")).toBe("Root");
    expect(toTypeName("123abc")).toBe("Abc");
    expect(toTypeName("usuário")).toBe("Usuario");
  });

  it("generates interfaces with optional, null and mixed-array fields", async () => {
    const json = JSON.stringify([
      { id: 1, name: "a", tags: ["x", 1], parent: null },
      { id: 2, name: "b", email: "c@d.e", parent: null },
    ]);
    const r = await jsonToTypes({ json, target: "typescript", rootName: "user" });
    expect(r.ok).toBe(true);
    const code = out(r);
    expect(code).toMatch(/export interface User \{/);
    expect(code).toMatch(/email\?:\s+string;/);
    expect(code).toMatch(/tags\?:\s+Array<number \| string>|tags\?:\s+\(number \| string\)\[\]/);
    expect(code).toMatch(/parent:\s+null;/);
  });

  it("can emit type aliases and readonly fields", async () => {
    const r = await jsonToTypes({
      json: '{"a":1}',
      target: "typescript",
      rootName: "Cfg",
      preferTypes: true,
      readonly: true,
    });
    expect(out(r)).toMatch(/export type Cfg = \{\s+readonly a: number;/);
  });

  it("generates a Zod schema, wrapping array roots", async () => {
    const obj = await jsonToTypes({ json: '{"name":"x","age":3}', target: "typescript-zod", rootName: "Person" });
    expect(out(obj)).toContain('import * as z from "zod"');
    expect(out(obj)).toContain("export const PersonSchema = z.object({");
    const arr = await jsonToTypes({ json: '[{"n":1}]', target: "typescript-zod", rootName: "Item" });
    expect(out(arr)).toContain("export const ItemSchema = z.array(ItemElementSchema);");
  });

  it("rejects invalid JSON with its position, and primitives", async () => {
    const bad = await jsonToTypes({ json: '{"a": }', target: "typescript", rootName: "X" });
    expect(bad).toMatchObject({ ok: false, line: 1 });
    expect((await jsonToTypes({ json: "42", target: "typescript", rootName: "X" })).ok).toBe(false);
  });
});

describe("JSON → Mock", () => {
  const sample = JSON.stringify({
    id: 1,
    email: "ada@example.com",
    firstName: "Ada",
    createdAt: "2024-01-01T10:00:00Z",
    birthday: "1990-05-01",
    price: 9.99,
    active: true,
    avatar: "https://x.com/a.png",
    tags: ["a", "b"],
    address: { city: "Madrid", zip: "28001" },
    deletedAt: null,
  });

  it("keeps the structure and produces realistic values", () => {
    const r = generateMock(sample, { count: 3, seed: 42 });
    const records = JSON.parse(out(r)) as Record<string, unknown>[];
    expect(records).toHaveLength(3);
    expect(records.map((x) => x.id)).toEqual([1, 2, 3]);
    for (const rec of records) {
      expect(Object.keys(rec).sort()).toEqual(Object.keys(JSON.parse(sample)).sort());
      expect(rec.email).toMatch(/^[^@]+@[^@]+\.[a-z]+$/);
      expect(rec.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(rec.birthday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof rec.price).toBe("number");
      expect(typeof rec.active).toBe("boolean");
      expect(rec.deletedAt).toBeNull();
      expect((rec.address as Record<string, unknown>).city).toEqual(expect.any(String));
    }
  });

  it("is reproducible with a seed", () => {
    expect(generateMock(sample, { count: 2, seed: 7 })).toEqual(generateMock(sample, { count: 2, seed: 7 }));
  });

  it("merges array samples into one template", () => {
    expect(mergeTemplate([{ a: 1 }, { b: "x" }, { a: null }])).toEqual({ a: 1, b: "x" });
  });

  it("validates count and input", () => {
    expect(generateMock(sample, { count: 0 }).ok).toBe(false);
    expect(generateMock(sample, { count: 1001 }).ok).toBe(false);
    expect(generateMock('"text"', { count: 1 }).ok).toBe(false);
    expect(generateMock("{oops", { count: 1 }).ok).toBe(false);
  });
});

describe("JSON Diff", () => {
  it("builds readable paths", () => {
    expect(joinPath("", "user")).toBe("user");
    expect(joinPath("user", "city")).toBe("user.city");
    expect(joinPath("items", 2)).toBe("items[2]");
    expect(joinPath("headers", "content-type")).toBe('headers["content-type"]');
  });

  it("reports added, removed and changed values by path, ignoring key order", () => {
    const a = { user: { name: "Ada", address: { city: "London" } }, tags: ["a", "b"], old: true };
    const b = { tags: ["a", "c", "d"], user: { address: { city: "Paris" }, name: "Ada" }, extra: 1 };
    const d = diffJson(a, b);
    expect(d).toContainEqual({ path: "user.address.city", kind: "changed", before: "London", after: "Paris" });
    expect(d).toContainEqual({ path: "tags[1]", kind: "changed", before: "b", after: "c" });
    expect(d).toContainEqual({ path: "tags[2]", kind: "added", after: "d" });
    expect(d).toContainEqual({ path: "old", kind: "removed", before: true });
    expect(d).toContainEqual({ path: "extra", kind: "added", after: 1 });
    expect(summarize(d)).toEqual({ added: 2, removed: 1, changed: 2 });
  });

  it("returns nothing for equal documents and handles type changes", () => {
    expect(diffJson({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toEqual([]);
    expect(diffJson({ a: 1 }, { a: "1" })).toEqual([{ path: "a", kind: "changed", before: 1, after: "1" }]);
    expect(diffJson(1, 2)).toEqual([{ path: "(root)", kind: "changed", before: 1, after: 2 }]);
  });
});

describe("JSON ↔ YAML", () => {
  it("converts both ways", () => {
    expect(out(jsonToYaml('{"name":"app","ports":[80,443],"debug":false}'))).toBe(
      "name: app\nports:\n  - 80\n  - 443\ndebug: false\n",
    );
    expect(JSON.parse(out(yamlToJson("on:\n  push:\n    branches: [main]\n")))).toEqual({
      on: { push: { branches: ["main"] } },
    });
  });

  it("turns multiple documents into an array", () => {
    expect(JSON.parse(out(yamlToJson("a: 1\n---\nb: 2\n")))).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("marks indentation errors with their line", () => {
    const r = yamlToJson("a:\n  b: 1\n c: 2\n");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.line).toBe(3);
  });

  it("rejects invalid JSON", () => {
    expect(jsonToYaml("{a:1}").ok).toBe(false);
  });
});

describe("JSON ↔ CSV", () => {
  it("flattens and rebuilds nested objects and arrays", () => {
    const value = { id: 1, address: { city: "Madrid" }, tags: ["a", "b"], empty: [] };
    const flat = flatten(value);
    expect(flat).toEqual({ id: 1, "address.city": "Madrid", "tags.0": "a", "tags.1": "b", empty: "[]" });
    expect(unflatten(flat)).toEqual(value);
  });

  it("converts JSON to CSV with the union of columns", () => {
    const csv = out(jsonToCsv('[{"id":1,"user":{"name":"Ada, L."}},{"id":2,"extra":true}]'));
    expect(csv).toBe('id,user.name,extra\n1,"Ada, L.",\n2,,true');
    expect(out(jsonToCsv('{"a":1,"b":2}', ";"))).toBe("a;b\n1;2");
  });

  it("converts CSV to typed JSON and detects the delimiter", () => {
    const rows = JSON.parse(out(csvToJson("id;user.name;active;note\n1;Ada;true;\n2;Bob;false;x")));
    expect(rows).toEqual([
      { id: 1, user: { name: "Ada" }, active: true, note: null },
      { id: 2, user: { name: "Bob" }, active: false, note: "x" },
    ]);
  });

  it("round-trips", () => {
    const json = '[{"a":{"b":1},"c":"x"}]';
    expect(JSON.parse(out(csvToJson(out(jsonToCsv(json)))))).toEqual(JSON.parse(json));
  });

  it("rejects bad input", () => {
    expect(jsonToCsv("[1,2]").ok).toBe(false);
    expect(jsonToCsv("[]").ok).toBe(false);
    expect(csvToJson("").ok).toBe(false);
    expect(csvToJson('a,b\n"1,2\n').ok).toBe(false);
  });
});
