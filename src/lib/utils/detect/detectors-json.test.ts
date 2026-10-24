import { describe, expect, it } from "vitest";
import { detectCsv, detectHttpHeaders, detectKind, detectYaml } from "./detectors";

describe("detectYaml", () => {
  it.each([
    ["docker-compose", "services:\n  web:\n    image: nginx\n    ports:\n      - 80:80\n"],
    ["GitHub Actions", "name: CI\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n"],
    ["document marker", "---\ntitle: Hello\ntags:\n  - a\n"],
    ["list at root", "- name: a\n  value: 1\n- name: b\n  value: 2\n"],
  ])("detects %s", (_, input) => {
    expect(detectYaml(input)?.kind).toBe("yaml");
    expect(detectKind(input)?.kind).toBe("yaml");
  });

  it("gives flat key: value text a low confidence", () => {
    expect(detectYaml("name: app\nversion: 2")?.confidence).toBeLessThan(0.6);
  });

  it.each([
    ["HTTP headers", "Content-Type: text/html\nCache-Control: no-cache"],
    ["Mermaid", "sequenceDiagram\n  A->>B: hi\n  B-->>A: ok"],
    ["JSON", '{"a": 1,\n"b": 2}'],
    ["one line", "a: 1"],
    ["prose", "Hello there\nthis is: not yaml at all\nreally"],
  ])("ignores %s", (_, input) => {
    expect(detectYaml(input)).toBeNull();
  });
});

describe("detectHttpHeaders is stricter without a status line", () => {
  it("still detects real headers", () => {
    expect(detectHttpHeaders("content-type: application/json\nx-request-id: 42")?.kind).toBe("http-headers");
  });

  it("ignores YAML that looks like headers", () => {
    expect(detectHttpHeaders("name: app\nversion: 2")).toBeNull();
    expect(detectHttpHeaders("server:\n  port: 80\nhost: x")).toBeNull();
  });
});

describe("detectCsv", () => {
  it.each([
    ["commas", "id,name,email\n1,Ada,ada@x.com\n2,Bob,bob@x.com", 0.8],
    ["semicolons", "id;name\n1;Ada\n2;Bob", 0.6],
    ["tabs", "a\tb\tc\n1\t2\t3", 0.8],
    ["quoted delimiters", 'name,city\n"Doe, John",Madrid\n"Roe, Jane",Paris', 0.6],
  ])("detects %s", (_, input, confidence) => {
    expect(detectCsv(input)).toEqual({ kind: "csv", confidence });
  });

  it.each([
    ["a single line", "a,b,c"],
    ["inconsistent columns", "a,b,c\n1,2\n3"],
    ["JSON arrays", "[1,2]\n[3,4]"],
    ["prose with commas", "Hello, world\nNo commas here"],
  ])("ignores %s", (_, input) => {
    expect(detectCsv(input)).toBeNull();
  });
});
