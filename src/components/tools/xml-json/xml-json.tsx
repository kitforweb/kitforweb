"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { ToolbarField, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { jsonToXml, xmlToJson } from "@/lib/utils/xml/xml";

const XML_EXAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<invoice number="INV-2026-042" currency="EUR">
  <customer id="c-17">
    <name>Ada Lovelace</name>
    <email>ada@example.com</email>
  </customer>
  <line sku="BK-01" qty="2">Analytical Engine manual</line>
  <line sku="PN-07" qty="1">Fountain pen</line>
  <total>59.90</total>
  <paid>true</paid>
</invoice>`;

const JSON_EXAMPLE = `{
  "invoice": {
    "@_number": "INV-2026-042",
    "customer": { "@_id": "c-17", "name": "Ada Lovelace" },
    "line": [
      { "@_sku": "BK-01", "#text": "Analytical Engine manual" },
      { "@_sku": "PN-07", "#text": "Fountain pen" }
    ],
    "total": 59.9
  }
}`;

export default function XmlJson() {
  const t = useTranslations("tools.xml-json");
  const [prefix, setPrefix] = useState("@_");
  const [parseValues, setParseValues] = useState(true);

  const convert = useCallback(
    (input: string, direction: number) =>
      direction === 0
        ? xmlToJson(input, { attributePrefix: prefix, parseValues })
        : jsonToXml(input, { attributePrefix: prefix }),
    [prefix, parseValues],
  );

  return (
    <ConverterTool
      toolId="xml-json"
      directions={[
        { input: { label: "input.xml", language: "xml" }, output: { label: "output.json", language: "json" } },
        { input: { label: "input.json", language: "json" }, output: { label: "output.xml", language: "xml" } },
      ]}
      convert={convert}
      example={(d) => (d === 0 ? XML_EXAMPLE : JSON_EXAMPLE)}
      placeholder={t("placeholder")}
      fileAccept=".xml,.json"
      toolbar={(d) => (
        <>
          <span className="px-1 font-mono text-xs text-accent-text">{d === 0 ? "XML → JSON" : "JSON → XML"}</span>
          <ToolbarField label={t("prefix")} value={prefix} onChange={setPrefix} width="w-16" />
          {d === 0 && <ToolbarSwitch label={t("parseValues")} checked={parseValues} onChange={setParseValues} />}
        </>
      )}
    />
  );
}
