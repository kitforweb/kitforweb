"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { ToolbarField, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { brandExamples, exampleText } from "@/lib/examples";
import { fail, ok } from "@/lib/utils/convert/result";
import { DEFAULT_REACT_OPTIONS, svgToReact, type SvgToReactOptions } from "@/lib/utils/image/svg-to-react";

export default function SvgToReact() {
  const t = useTranslations("tools.svg-to-react");
  const [options, setOptions] = useState<SvgToReactOptions>({ ...DEFAULT_REACT_OPTIONS, name: "LogoIcon" });
  const set = <K extends keyof SvgToReactOptions>(k: K, v: SvgToReactOptions[K]) =>
    setOptions((o) => ({ ...o, [k]: v }));

  const convert = useCallback(
    (input: string) => {
      const r = svgToReact(input, options);
      if (!r.ok) return fail(t(`errors.${r.error}`));
      const warnings =
        options.currentColor && r.colors.length > 1 ? [t("multicolor", { colors: r.colors.join(", ") })] : [];
      return ok(r.output, warnings);
    },
    [options, t],
  );

  return (
    <ConverterTool
      toolId="svg-to-react"
      directions={[
        {
          input: { label: "icon.svg", language: "xml" },
          output: {
            label: `${options.name || "Icon"}.${options.typescript ? "tsx" : "jsx"}`,
            language: options.typescript ? "tsx" : "jsx",
          },
        },
      ]}
      convert={convert}
      example={() => {
        // The brand icon has three colors: keep them instead of collapsing to currentColor.
        set("currentColor", false);
        return exampleText(brandExamples.icon);
      }}
      placeholder={t("placeholder")}
      fileAccept=".svg,image/svg+xml"
      toolbar={
        <>
          <ToolbarField label={t("name")} value={options.name} onChange={(v) => set("name", v)} width="w-28" />
          <ToolbarSwitch label="TypeScript" checked={options.typescript} onChange={(v) => set("typescript", v)} />
          <ToolbarSwitch label="currentColor" checked={options.currentColor} onChange={(v) => set("currentColor", v)} />
          <ToolbarSwitch label={t("size")} checked={options.sizeProp} onChange={(v) => set("sizeProp", v)} />
          <ToolbarSwitch label="memo" checked={options.memo} onChange={(v) => set("memo", v)} />
        </>
      }
    />
  );
}
