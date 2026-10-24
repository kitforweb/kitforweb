"use client";

import { useMemo, useState } from "react";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { ColorField } from "@/components/shared/color-field";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarField } from "@/components/shared/toolbar-controls";
import { useToolInput } from "@/hooks/use-tool-input";
import { colorScale, contrastReport, exportScale, parseColor, type ScaleFormat } from "@/lib/utils/css/color";
import { cn } from "cn";

const WHITE = parseColor("#fff")!;
const BLACK = parseColor("#000")!;

export default function ColorScale() {
  const t = useTranslations("tools.color-scale");
  const [text, setText] = useToolInput("color-scale", "");
  const [name, setName] = useState("brand");
  const [format, setFormat] = useState<ScaleFormat>("tailwind4");
  const [space, setSpace] = useState<"oklch" | "hex">("oklch");

  const color = useMemo(() => (text.trim() ? parseColor(text) : null), [text]);
  const scale = useMemo(() => (color ? colorScale(color) : null), [color]);
  const code = scale ? exportScale(name, scale, format, format === "tailwind3" ? "hex" : space) : "";

  return (
    <ToolShell
      toolId="color-scale"
      inputLabel={t("base")}
      outputLabel={t("export")}
      defaultInputSize={55}
      onExample={() => setText("#6d28d9")}
      onClear={() => setText("")}
      copyText={code}
      toolbar={
        <>
          <ToolbarField label={t("name")} value={name} onChange={setName} width="w-24" />
          <Segmented
            label={t("format")}
            value={format}
            onChange={setFormat}
            options={[
              { value: "tailwind4", label: "Tailwind v4" },
              { value: "tailwind3", label: "Tailwind v3" },
              { value: "css", label: "CSS" },
              { value: "scss", label: "SCSS" },
            ]}
          />
          {format !== "tailwind3" && (
            <Segmented
              label={t("space")}
              value={space}
              onChange={setSpace}
              options={[
                { value: "oklch", label: "OKLCH" },
                { value: "hex", label: "HEX" },
              ]}
            />
          )}
        </>
      }
      input={
        <div className="space-y-4 p-4">
          <ColorField label={t("base")} value={text} onChange={setText} />
          {text.trim() && !color && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <CircleAlert className="size-4" aria-hidden />
              {t("invalid")}
            </p>
          )}
          {scale && (
            <ol className="grid grid-cols-1 overflow-hidden rounded-lg border" data-testid="scale-swatches">
              {scale.map((s) => {
                const c = parseColor(s.hex)!;
                // Label in white or black, whichever reads better on the swatch.
                const light = contrastReport(WHITE, c).ratio >= contrastReport(BLACK, c).ratio;
                return (
                  <li
                    key={s.step}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 font-mono text-xs",
                      light ? "text-white" : "text-black",
                    )}
                    style={{ background: s.hex }}
                    data-step={s.step}
                  >
                    <span className="w-10 font-semibold">{s.step}</span>
                    <span className="flex-1">{s.hex}</span>
                    {s.base && <span className="rounded border border-current px-1.5 text-[10px]">{t("input")}</span>}
                    <CopyButton text={s.hex} size="icon-sm" />
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-xs text-muted-foreground">{t("how")}</p>
        </div>
      }
      output={
        scale ? (
          <div className="h-full" data-testid="scale-code">
            <CodeEditor
              value={code}
              readOnly
              language={format === "tailwind3" ? "javascript" : "css"}
              ariaLabel={t("export")}
            />
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">{t("hint")}</p>
        )
      }
    />
  );
}
