"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { ToolbarField } from "@/components/shared/toolbar-controls";
import { useDebounced } from "@/hooks/use-debounced";
import { toTypeName } from "@/lib/utils/json/type-name";
import { runQuicktype } from "@/lib/workers";

const EXAMPLE = `{
  "id": "0190a5b8-6e1f-7c3a-9b2d-4e5f6a7b8c9d",
  "title": "Ship the release",
  "done": false,
  "priority": 2,
  "tags": ["work", "urgent"],
  "assignee": { "name": "Ada", "email": "ada@example.com" },
  "dueDate": null
}`;

export default function JsonToZod() {
  const t = useTranslations("tools.json-to-zod");
  const [rootName, setRootName] = useState("Task");
  const name = useDebounced(rootName, 300);

  const convert = useCallback(
    (json: string) => runQuicktype({ json, target: "typescript-zod", rootName: name }),
    [name],
  );

  return (
    <ConverterTool
      toolId="json-to-zod"
      directions={[
        {
          input: { label: "input.json", language: "json" },
          output: {
            label: `${toTypeName(name).replace(/^./, (c) => c.toLowerCase())}.schema.ts`,
            language: "typescript",
          },
        },
      ]}
      convert={convert}
      example={EXAMPLE}
      placeholder={t("placeholder")}
      fileAccept=".json,application/json"
      toolbar={<ToolbarField label={t("rootName")} value={rootName} onChange={setRootName} />}
    />
  );
}
