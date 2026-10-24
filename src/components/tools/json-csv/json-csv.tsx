"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { ToolbarSelect } from "@/components/shared/toolbar-controls";
import { csvToJson, jsonToCsv, type Delimiter } from "@/lib/utils/json/csv";

const JSON_EXAMPLE = `[
  { "id": 1, "name": "Ada Lovelace", "email": "ada@example.com", "address": { "city": "London", "country": "UK" }, "active": true },
  { "id": 2, "name": "Grace Hopper", "email": "grace@example.com", "address": { "city": "New York", "country": "US" }, "active": false },
  { "id": 3, "name": "Margaret Hamilton", "email": "margaret@example.com", "address": { "city": "Boston", "country": "US" }, "active": true }
]`;

const CSV_EXAMPLE = `id;product;price;stock.warehouse;stock.units
1;Keyboard;49.90;MAD;120
2;Mouse;19.50;BCN;300
3;Monitor;229;MAD;
`;

type DelimiterOption = Delimiter | "auto";

export default function JsonCsv() {
  const t = useTranslations("tools.json-csv");
  const [delimiter, setDelimiter] = useState<DelimiterOption>("auto");

  const convert = useCallback(
    (input: string, direction: number) =>
      direction === 0 ? jsonToCsv(input, delimiter === "auto" ? "," : delimiter) : csvToJson(input, delimiter),
    [delimiter],
  );

  const options = [
    { value: "auto" as const, label: t("auto") },
    { value: "," as const, label: t("comma") },
    { value: ";" as const, label: t("semicolon") },
    { value: "\t" as const, label: t("tab") },
    { value: "|" as const, label: t("pipe") },
  ];

  return (
    <ConverterTool
      toolId="json-csv"
      directions={[
        { input: { label: "input.json", language: "json" }, output: { label: "output.csv" } },
        { input: { label: "input.csv" }, output: { label: "output.json", language: "json" } },
      ]}
      convert={convert}
      example={(d) => (d === 0 ? JSON_EXAMPLE : CSV_EXAMPLE)}
      placeholder={t("placeholder")}
      fileAccept=".json,.csv,.tsv,text/csv"
      toolbar={(d) => (
        <>
          <span className="px-1 font-mono text-xs text-accent-text">{d === 0 ? "JSON → CSV" : "CSV → JSON"}</span>
          <ToolbarSelect label={t("delimiter")} value={delimiter} onChange={setDelimiter} options={options} />
        </>
      )}
    />
  );
}
