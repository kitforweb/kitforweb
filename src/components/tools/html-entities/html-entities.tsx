"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { ToolbarSelect, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { ok } from "@/lib/utils/convert/result";
import { decodeEntities, encodeEntities, type EntityStyle } from "@/lib/utils/encoding/entities";

const EXAMPLE = `<p class="note">Tom & Jerry's "café" — 5 > 3 ✓</p>`;
const ENCODED_EXAMPLE = "&lt;h1&gt;Caf&eacute; &amp; t&#233; &#x2615;&lt;/h1&gt;";

export default function HtmlEntities() {
  const t = useTranslations("tools.html-entities");
  const [style, setStyle] = useState<EntityStyle>("named");
  const [nonAscii, setNonAscii] = useState(false);

  const convert = useCallback(
    (input: string, direction: number) =>
      ok(direction === 0 ? encodeEntities(input, { style, nonAscii }) : decodeEntities(input)),
    [style, nonAscii],
  );

  return (
    <ConverterTool
      toolId="html-entities"
      directions={[
        { input: { label: t("text"), language: "html" }, output: { label: t("encoded") } },
        { input: { label: t("encoded") }, output: { label: t("text"), language: "html" } },
      ]}
      convert={convert}
      example={(d) => (d === 0 ? EXAMPLE : ENCODED_EXAMPLE)}
      placeholder={t("placeholder")}
      wrapOutput
      toolbar={(d) => (
        <>
          <span className="px-1 font-mono text-xs text-accent-text">{d === 0 ? t("encode") : t("decode")}</span>
          {d === 0 && (
            <>
              <ToolbarSelect
                label={t("style")}
                value={style}
                onChange={setStyle}
                options={[
                  { value: "named", label: "&amp;" },
                  { value: "decimal", label: "&#38;" },
                  { value: "hex", label: "&#x26;" },
                ]}
              />
              <ToolbarSwitch label={t("nonAscii")} checked={nonAscii} onChange={setNonAscii} />
            </>
          )}
        </>
      )}
    />
  );
}
