import { describe, expect, it } from "vitest";
import { detectAll, detectJsonSchema, detectOpenApi, detectSqlDdl } from "./detectors";
import { resolveDetections } from "./resolve";

describe("detectSqlDdl", () => {
  it("detects CREATE TABLE in any dialect", () => {
    expect(detectSqlDdl("CREATE TABLE users (id int)")?.kind).toBe("sql-ddl");
    expect(detectSqlDdl("create table if not exists `shop`.`items` (\n id int\n)")?.kind).toBe("sql-ddl");
    expect(detectSqlDdl("-- schema\nCREATE TEMPORARY TABLE t (x text);")?.kind).toBe("sql-ddl");
  });

  it("ignores queries", () => {
    expect(detectSqlDdl("SELECT * FROM users")).toBeNull();
  });

  it("offers both the formatter and the ER diagram", () => {
    const map: Record<string, string> = { sql: "sql-formatter", "sql-ddl": "sql-er" };
    const r = resolveDetections("CREATE TABLE users (id int PRIMARY KEY)", (k) => map[k]);
    expect(r.candidates.map((c) => c.toolId)).toEqual(["sql-er", "sql-formatter"]);
    expect(r.auto).toBeNull();
  });
});

describe("detectOpenApi", () => {
  it.each([
    "openapi: 3.0.3\ninfo:\n  title: x",
    "openapi: '3.1.0'\npaths: {}",
    'swagger: "2.0"\ninfo: {}',
    '{\n  "openapi": "3.0.0",\n  "info": {}\n}',
  ])("detects %#", (input) => {
    expect(detectOpenApi(input)?.kind).toBe("openapi");
  });

  it("beats plain YAML", () => {
    expect(detectAll("openapi: 3.0.3\ninfo:\n  title: x\n  version: '1'").map((d) => d.kind)).toEqual(
      expect.arrayContaining(["openapi", "yaml"]),
    );
  });

  it("ignores other documents", () => {
    expect(detectOpenApi("name: CI\non: push")).toBeNull();
    expect(detectOpenApi('{"version": "3.0"}')).toBeNull();
  });
});

describe("detectJsonSchema", () => {
  it("detects schemas", () => {
    expect(detectJsonSchema('{"$schema":"https://json-schema.org/draft/2020-12/schema"}')).toEqual({
      kind: "json-schema",
      confidence: 0.97,
    });
    expect(detectJsonSchema('{"type":"object","properties":{"a":{}}}')).toEqual({
      kind: "json-schema",
      confidence: 0.75,
    });
  });

  it("ignores ordinary JSON", () => {
    expect(detectJsonSchema('{"type":"object"}')).toBeNull();
    expect(detectJsonSchema('{"properties": {}}')).toBeNull();
  });
});
