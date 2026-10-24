"use client";

import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { ToolbarField } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { generateMock } from "@/lib/utils/json/mock";

const EXAMPLE = `{
  "id": 1,
  "firstName": "Ada",
  "lastName": "Lovelace",
  "email": "ada@example.com",
  "avatar": "https://example.com/ada.png",
  "isActive": true,
  "balance": 1520.75,
  "createdAt": "2024-03-01T09:30:00Z",
  "address": { "street": "12 St James's Square", "city": "London", "country": "United Kingdom" },
  "tags": ["vip", "beta"]
}`;

const randomSeed = () => Math.floor(Math.random() * 1_000_000);

export default function JsonMock() {
  const t = useTranslations("tools.json-mock");
  const [count, setCount] = useState("5");
  const [seed, setSeed] = useState(randomSeed);

  const convert = useCallback((json: string) => generateMock(json, { count: Number(count), seed }), [count, seed]);

  return (
    <ConverterTool
      toolId="json-mock"
      directions={[
        { input: { label: "sample.json", language: "json" }, output: { label: "mock.json", language: "json" } },
      ]}
      convert={convert}
      example={EXAMPLE}
      placeholder={t("placeholder")}
      fileAccept=".json,application/json"
      toolbar={
        <>
          <ToolbarField
            label={t("count")}
            type="number"
            min={1}
            max={1000}
            width="w-20"
            value={count}
            onChange={setCount}
          />
          <ToolbarField
            label={t("seed")}
            type="number"
            width="w-24"
            value={seed}
            onChange={(v) => setSeed(Number(v) || 0)}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setSeed(randomSeed())}>
            <RefreshCw />
            {t("regenerate")}
          </Button>
        </>
      }
    />
  );
}
