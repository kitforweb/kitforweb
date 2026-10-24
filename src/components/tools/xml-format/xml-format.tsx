"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { Segmented, ToolbarSelect } from "@/components/shared/toolbar-controls";
import { formatXml, minifyXml } from "@/lib/utils/xml/xml";

const EXAMPLE = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><!-- order lookup --><GetOrder xmlns="urn:shop"><OrderId>1042</OrderId><Fields><Field>status</Field><Field>total</Field></Fields><Note><![CDATA[Ship <fast> & safe]]></Note></GetOrder></soap:Body></soap:Envelope>`;

export default function XmlFormat() {
  const t = useTranslations("tools.xml-format");
  const [mode, setMode] = useState<"format" | "minify">("format");
  const [indent, setIndent] = useState<"2" | "4">("2");

  const convert = useCallback(
    (xml: string) => (mode === "minify" ? minifyXml(xml) : formatXml(xml, Number(indent))),
    [mode, indent],
  );

  return (
    <ConverterTool
      toolId="xml-format"
      directions={[
        {
          input: { label: "input.xml", language: "xml" },
          output: { label: mode === "minify" ? "output.min.xml" : "output.xml", language: "xml" },
        },
      ]}
      convert={convert}
      example={EXAMPLE}
      placeholder={t("placeholder")}
      fileAccept=".xml,.svg,.xsd,.wsdl,text/xml"
      wrapOutput={mode === "minify"}
      toolbar={
        <>
          <Segmented
            label={t("mode")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "format", label: t("format") },
              { value: "minify", label: t("minify") },
            ]}
          />
          {mode === "format" && (
            <ToolbarSelect
              label={t("indent")}
              value={indent}
              onChange={setIndent}
              options={[
                { value: "2", label: t("spaces", { n: 2 }) },
                { value: "4", label: t("spaces", { n: 4 }) },
              ]}
            />
          )}
        </>
      }
    />
  );
}
