"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { ToolbarSelect } from "@/components/shared/toolbar-controls";
import { jsonToYaml, yamlToJson } from "@/lib/utils/json/yaml";

const JSON_EXAMPLE = `{
  "name": "CI",
  "on": { "push": { "branches": ["main"] }, "pull_request": null },
  "jobs": {
    "build": {
      "runs-on": "ubuntu-latest",
      "steps": [
        { "uses": "actions/checkout@v4" },
        { "run": "npm ci" },
        { "run": "npm test" }
      ]
    }
  }
}`;

const YAML_EXAMPLE = `services:
  web:
    image: nginx:1.27
    ports:
      - "8080:80"
    environment:
      NODE_ENV: production
    depends_on: [db]
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata: {}
`;

export default function JsonYaml() {
  const t = useTranslations("tools.json-yaml");
  const [indent, setIndent] = useState<"2" | "4">("2");

  const convert = useCallback(
    (input: string, direction: number) =>
      direction === 0 ? jsonToYaml(input, Number(indent)) : yamlToJson(input, Number(indent)),
    [indent],
  );

  return (
    <ConverterTool
      toolId="json-yaml"
      directions={[
        { input: { label: "input.json", language: "json" }, output: { label: "output.yaml", language: "yaml" } },
        { input: { label: "input.yaml", language: "yaml" }, output: { label: "output.json", language: "json" } },
      ]}
      convert={convert}
      example={(d) => (d === 0 ? JSON_EXAMPLE : YAML_EXAMPLE)}
      placeholder={t("placeholder")}
      fileAccept=".json,.yaml,.yml"
      toolbar={(d) => (
        <>
          <span className="px-1 font-mono text-xs text-accent-text">{d === 0 ? "JSON → YAML" : "YAML → JSON"}</span>
          <ToolbarSelect
            label={t("indent")}
            value={indent}
            onChange={setIndent}
            options={[
              { value: "2", label: t("spaces", { n: 2 }) },
              { value: "4", label: t("spaces", { n: 4 }) },
            ]}
          />
        </>
      )}
    />
  );
}
