"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { Segmented, ToolbarField, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { useDebounced } from "@/hooks/use-debounced";
import { toTypeName } from "@/lib/utils/json/type-name";
import { runQuicktype } from "@/lib/workers";

export const JSON_TYPES_EXAMPLE = `[
  {
    "id": 1,
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "roles": ["admin", "editor"],
    "address": { "city": "London", "zip": null },
    "lastLogin": "2024-05-01T10:00:00Z"
  },
  {
    "id": 2,
    "name": "Alan Turing",
    "roles": ["viewer"],
    "address": { "city": "Wilmslow", "zip": "SK9" },
    "scores": [9.5, "n/a"]
  }
]`;

export default function JsonToTs() {
  const t = useTranslations("tools.json-to-ts");
  const [rootName, setRootName] = useState("User");
  const [kind, setKind] = useState<"interface" | "type">("interface");
  const [readonly, setReadonly] = useState(false);
  const name = useDebounced(rootName, 300);

  const convert = useCallback(
    (json: string) =>
      runQuicktype({ json, target: "typescript", rootName: name, preferTypes: kind === "type", readonly }),
    [name, kind, readonly],
  );

  return (
    <ConverterTool
      toolId="json-to-ts"
      directions={[
        {
          input: { label: "input.json", language: "json" },
          output: { label: `${toTypeName(name)}.ts`, language: "typescript" },
        },
      ]}
      convert={convert}
      example={JSON_TYPES_EXAMPLE}
      placeholder={t("placeholder")}
      fileAccept=".json,application/json"
      toolbar={
        <>
          <ToolbarField label={t("rootName")} value={rootName} onChange={setRootName} />
          <Segmented
            label={t("declaration")}
            value={kind}
            onChange={setKind}
            options={[
              { value: "interface", label: "interface" },
              { value: "type", label: "type" },
            ]}
          />
          <ToolbarSwitch label="readonly" checked={readonly} onChange={setReadonly} />
        </>
      }
    />
  );
}
