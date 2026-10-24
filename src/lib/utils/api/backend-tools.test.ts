import { describe, expect, it } from "vitest";
import { formatSql, minifySql } from "../sql/format";
import { parseSchema, toMermaidEr, unquote } from "../sql/er";
import { formatXml, jsonToXml, minifyXml, validateXml, xmlToJson } from "../xml/xml";
import { generateSchema, inferSchema, validateJsonSchema } from "./json-schema";
import { deref, parseOpenApi, resolveRef } from "./openapi";

const out = (r: { ok: boolean; output?: string }) => (r.ok ? (r as { output: string }).output : "");

describe("SQL formatter", () => {
  it("formats with upper-case keywords and one clause per line", () => {
    expect(
      out(
        formatSql("select id,name from users where active=true order by name", {
          dialect: "postgresql",
          keywordCase: "upper",
          indent: 2,
        }),
      ),
    ).toBe("SELECT\n  id,\n  name\nFROM\n  users\nWHERE\n  active = TRUE\nORDER BY\n  name");
  });

  it("supports dialects and indentation", () => {
    expect(
      out(formatSql("SELECT TOP 5 * FROM [dbo].[t]", { dialect: "tsql", keywordCase: "upper", indent: 4 })),
    ).toContain("    [dbo].[t]");
  });

  it("reports parse errors", () => {
    const r = formatSql("SELECT * FROM t WHERE 'unclosed", { dialect: "sql", keywordCase: "upper", indent: 2 });
    expect(r.ok).toBe(false);
  });

  it("minifies, keeping strings and dropping comments", () => {
    expect(minifySql("SELECT a , b -- comment\nFROM t /* x */\nWHERE c = 'two  spaces' AND d = 'it''s'")).toBe(
      "SELECT a, b FROM t WHERE c = 'two  spaces' AND d = 'it''s'",
    );
  });
});

describe("SQL → ER diagram", () => {
  const ddl = `
    CREATE TABLE public.users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT now()
    );
    CREATE TABLE "orders" (
      id BIGINT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      total NUMERIC(10, 2),
      CONSTRAINT orders_pk PRIMARY KEY (id)
    );
    CREATE TABLE profiles (
      user_id INT PRIMARY KEY,
      bio TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
    CREATE TABLE \`order_items\` (
      order_id BIGINT NOT NULL,
      sku VARCHAR(20) NOT NULL,
      PRIMARY KEY (order_id, sku)
    );
    ALTER TABLE order_items ADD CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders (id);
  `;

  it("unquotes identifiers and drops the schema", () => {
    expect(unquote('public."users"')).toBe("users");
    expect(unquote("[dbo].[Users]")).toBe("Users");
    expect(unquote("`items`")).toBe("items");
  });

  it("parses tables, columns, keys and relations", () => {
    const s = parseSchema(ddl);
    expect(s.tables.map((t) => t.name)).toEqual(["users", "orders", "profiles", "order_items"]);
    const users = s.tables[0];
    expect(users.columns).toEqual([
      { name: "id", type: "SERIAL", pk: true, fk: false, notNull: true, unique: false },
      { name: "email", type: "VARCHAR(255)", pk: false, fk: false, notNull: true, unique: true },
      { name: "created_at", type: "TIMESTAMP", pk: false, fk: false, notNull: false, unique: false },
    ]);
    expect(s.tables[1].columns.find((c) => c.name === "id")?.pk).toBe(true);
    expect(s.tables[1].columns.find((c) => c.name === "total")?.type).toBe("NUMERIC(10, 2)");
    expect(s.relations).toEqual([
      { from: "orders", fromColumns: ["user_id"], to: "users", toColumns: ["id"], oneToOne: false, optional: false },
      { from: "profiles", fromColumns: ["user_id"], to: "users", toColumns: ["id"], oneToOne: true, optional: false },
      {
        from: "order_items",
        fromColumns: ["order_id"],
        to: "orders",
        toColumns: ["id"],
        oneToOne: false,
        optional: false,
      },
    ]);
  });

  it("generates a Mermaid erDiagram", () => {
    const m = toMermaidEr(parseSchema(ddl));
    expect(m.split("\n")[0]).toBe("erDiagram");
    expect(m).toContain('users ||--|{ orders : "user_id"');
    expect(m).toContain('users ||--|| profiles : "user_id"');
    expect(m).toContain("VARCHAR(255) email UK");
    expect(m).toContain("NUMERIC(10-2) total");
    expect(m).toContain('TIMESTAMP created_at "nullable"');
  });

  it("returns an empty schema when there is no CREATE TABLE", () => {
    expect(parseSchema("SELECT 1")).toEqual({ tables: [], relations: [] });
  });
});

describe("XML", () => {
  const xml =
    '<?xml version="1.0"?><order id="7"><item sku="A1">Pen</item><item sku="B2">Ink</item><!-- note --><qty>3</qty></order>';

  it("validates and locates errors", () => {
    expect(validateXml(xml)).toEqual({ ok: true });
    expect(validateXml("<a>\n  <b></a>")).toMatchObject({ ok: false, line: 2 });
  });

  it("converts XML to JSON keeping attributes", () => {
    const json = JSON.parse(out(xmlToJson(xml, { attributePrefix: "@_", parseValues: true })));
    expect(json.order["@_id"]).toBe(7);
    expect(json.order.item).toEqual([
      { "#text": "Pen", "@_sku": "A1" },
      { "#text": "Ink", "@_sku": "B2" },
    ]);
    expect(json.order.qty).toBe(3);
    const raw = JSON.parse(out(xmlToJson(xml, { attributePrefix: "$", parseValues: false })));
    expect(raw.order.$id).toBe("7");
  });

  it("converts JSON back to XML", () => {
    const x = out(
      jsonToXml('{"order":{"@_id":"7","item":[{"@_sku":"A1","#text":"Pen"}],"note":"a & b"}}', {
        attributePrefix: "@_",
      }),
    );
    expect(x).toContain('<order id="7">');
    expect(x).toContain('<item sku="A1">Pen</item>');
    expect(x).toContain("<note>a &amp; b</note>");
    expect(jsonToXml("[1]", { attributePrefix: "@_" }).ok).toBe(false);
    expect(jsonToXml('{"a":1,"b":2}', { attributePrefix: "@_" })).toMatchObject({
      ok: true,
      warnings: [expect.any(String)],
    });
  });

  it("pretty-prints keeping comments and inline text", () => {
    expect(out(formatXml(xml))).toBe(
      '<?xml version="1.0"?>\n<order id="7">\n  <item sku="A1">Pen</item>\n  <item sku="B2">Ink</item>\n  <!-- note -->\n  <qty>3</qty>\n</order>\n',
    );
    expect(out(formatXml("<a><b/><c></c><![CDATA[x < y]]></a>", 4))).toBe(
      "<a>\n    <b/>\n    <c></c>\n    <![CDATA[x < y]]>\n</a>\n",
    );
  });

  it("minifies", () => {
    expect(out(minifyXml("<a>\n  <b attr = 'x'>1</b>\n  <!-- c -->\n</a>"))).toBe("<a><b attr = 'x'>1</b></a>");
    expect(minifyXml("<a>").ok).toBe(false);
  });
});

describe("JSON Schema", () => {
  const schema = JSON.stringify({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    required: ["name", "email", "age"],
    properties: {
      name: { type: "string", minLength: 1 },
      email: { type: "string", format: "email" },
      age: { type: "integer", minimum: 18 },
      tags: { type: "array", items: { enum: ["a", "b"] } },
    },
    additionalProperties: false,
  });

  it("accepts valid data", () => {
    expect(validateJsonSchema(schema, '{"name":"Ada","email":"ada@example.com","age":36}')).toEqual({
      ok: true,
      valid: true,
    });
  });

  it("reports every error with a readable path and position", () => {
    const data =
      '{\n  "name": "Ada",\n  "email": "not-an-email",\n  "age": 12,\n  "tags": ["a", "z"],\n  "extra": 1\n}';
    const r = validateJsonSchema(schema, data);
    if (!r.ok || r.valid) throw new Error("expected errors");
    const byPath = Object.fromEntries(r.errors.map((e) => [e.path + ":" + e.keyword, e]));
    expect(byPath["email:format"]).toMatchObject({ message: "must be a valid email", line: 3 });
    expect(byPath["age:minimum"]).toMatchObject({ line: 4 });
    expect(byPath["tags[1]:enum"].message).toContain('"a", "b"');
    expect(byPath["(root):additionalProperties"].message).toContain("extra");
  });

  it("supports draft-07 schemas and reports missing properties", () => {
    const r = validateJsonSchema('{"type":"object","required":["id"]}', "{}");
    expect(r.ok && !r.valid && r.errors[0].message).toBe("missing required property “id”");
  });

  it("reports invalid schema or data", () => {
    expect(validateJsonSchema("{oops", "{}")).toMatchObject({ ok: false, error: "schema", line: 1 });
    expect(validateJsonSchema("{}", "[1,")).toMatchObject({ ok: false, error: "data" });
    expect(validateJsonSchema('{"type": "nope"}', "1")).toMatchObject({ ok: false, error: "schema" });
  });

  it("generates a schema from an example", () => {
    expect(
      inferSchema({ id: 1, email: "a@b.co", when: "2024-01-01T00:00:00Z", score: 1.5, tags: ["x"], extra: null }),
    ).toEqual({
      type: "object",
      properties: {
        id: { type: "integer" },
        email: { type: "string", format: "email" },
        when: { type: "string", format: "date-time" },
        score: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
        extra: { type: "null" },
      },
      required: ["id", "email", "when", "score", "tags", "extra"],
      additionalProperties: false,
    });
    expect(inferSchema([1, "a"])).toEqual({ type: "array", items: { type: ["integer", "string"] } });
    const g = generateSchema('[{"a":1},{"a":2,"b":true}]');
    expect(g.ok && JSON.parse(g.schema).items.required).toEqual(["a"]);
  });

  it("a generated schema validates its own example", () => {
    const data = '{"user":{"id":"0190a5b8-6e1f-7c3a-9b2d-4e5f6a7b8c9d","site":"https://a.com"},"n":[1,2]}';
    const g = generateSchema(data);
    expect(g.ok && validateJsonSchema(g.schema, data)).toEqual({ ok: true, valid: true });
  });
});

describe("OpenAPI", () => {
  const spec = `
openapi: 3.0.3
info:
  title: Shop API
  version: "1.2.0"
servers:
  - url: https://api.shop.test/v1
tags:
  - name: orders
paths:
  /orders/{orderId}:
    parameters:
      - $ref: "#/components/parameters/OrderId"
    get:
      tags: [orders]
      summary: Get an order
      operationId: getOrder
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Order"
        "404":
          description: Not found
  /orders:
    post:
      tags: [orders]
      operationId: createOrder
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Order"
      responses:
        "201":
          description: Created
  /items/{id}:
    get:
      operationId: getOrder
      responses: {}
components:
  parameters:
    OrderId:
      name: orderId
      in: path
      required: true
      schema: { type: string, format: uuid }
  schemas:
    Order:
      type: object
      properties:
        id: { type: string }
        parent: { $ref: "#/components/schemas/Order" }
        customer: { $ref: "#/components/schemas/Missing" }
`;

  it("builds a navigable model", () => {
    const r = parseOpenApi(spec);
    if (!r.ok) throw new Error(r.error);
    const { doc } = r;
    expect(doc).toMatchObject({
      version: "openapi-3",
      title: "Shop API",
      apiVersion: "1.2.0",
      servers: ["https://api.shop.test/v1"],
      schemas: ["Order"],
    });
    const get = doc.operations.find((o) => o.operationId === "getOrder" && o.path === "/orders/{orderId}")!;
    expect(get.parameters).toEqual([
      { name: "orderId", in: "path", required: true, type: "string (uuid)", description: undefined },
    ]);
    expect(get.responses.map((x) => x.status)).toEqual(["200", "404"]);
    expect((get.responses[0].schema as { properties: { id: unknown } }).properties.id).toEqual({ type: "string" });
    const post = doc.operations.find((o) => o.method === "post")!;
    expect(post.requestBody).toMatchObject({ required: true, contentTypes: ["application/json"] });
  });

  it("lists problems: undeclared path params, duplicates, empty responses, broken refs", () => {
    const r = parseOpenApi(spec);
    if (!r.ok) throw new Error();
    const messages = r.doc.issues.map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        "Path parameter “id” is not declared.",
        "Duplicate operationId “getOrder”.",
        "Every operation needs at least one response.",
        "Broken reference: #/components/schemas/Missing",
      ]),
    );
  });

  it("resolves refs and stops at cycles", () => {
    const root = { components: { schemas: { A: { properties: { self: { $ref: "#/components/schemas/A" } } } } } };
    expect(resolveRef(root, "#/components/schemas/A")).toBe(root.components.schemas.A);
    expect(deref(root, { $ref: "#/components/schemas/A" })).toEqual({
      properties: { self: { $ref: "#/components/schemas/A" } },
    });
  });

  it("supports Swagger 2.0 and JSON input", () => {
    const r = parseOpenApi(
      JSON.stringify({
        swagger: "2.0",
        info: { title: "Old", version: "1" },
        host: "api.test",
        basePath: "/v1",
        schemes: ["https"],
        paths: { "/ping": { get: { responses: { 200: { description: "ok" } } } } },
      }),
    );
    expect(r.ok && r.doc).toMatchObject({
      version: "swagger-2",
      servers: ["https://api.test/v1"],
      operations: [expect.objectContaining({ path: "/ping" })],
    });
  });

  it("rejects documents that are not OpenAPI", () => {
    expect(parseOpenApi("name: hello").ok).toBe(false);
    expect(parseOpenApi("openapi: [unclosed")).toMatchObject({ ok: false, line: 1 });
  });
});
