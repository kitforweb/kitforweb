"use client";

import { useMemo } from "react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { ColorField } from "@/components/shared/color-field";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { useToolInput } from "@/hooks/use-tool-input";
import { convertColor, type ColorFormats } from "@/lib/utils/css/color";

const ROWS: { key: keyof Pick<ColorFormats, "hex" | "rgb" | "hsl" | "oklch">; label: string }[] = [
  { key: "hex", label: "HEX" },
  { key: "rgb", label: "RGB" },
  { key: "hsl", label: "HSL" },
  { key: "oklch", label: "OKLCH" },
];

export default function ColorConverter() {
  const t = useTranslations("tools.color-converter");
  const [text, setText] = useToolInput("color-converter", "");
  const result = useMemo(() => (text.trim() ? convertColor(text) : null), [text]);
  const f = result?.ok ? result.formats : null;

  return (
    <ToolShell
      toolId="color-converter"
      inputLabel={t("color")}
      outputLabel={t("formats")}
      defaultInputSize={40}
      onExample={() => setText("#3b82f6")}
      onClear={() => setText("")}
      copyText={f?.hex ?? ""}
      input={
        <div className="space-y-4 p-4">
          <ColorField label={t("color")} value={text} onChange={setText} />
          <p className="text-xs text-muted-foreground">{t("accepts")}</p>
          {result && !result.ok && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <CircleAlert className="size-4" aria-hidden />
              {t("invalid")}
            </p>
          )}
          {f && (
            <div
              className="h-32 rounded-lg border"
              style={{ background: text.trim() }}
              aria-label={t("swatch")}
              data-testid="color-swatch"
            />
          )}
        </div>
      }
      output={
        !f ? (
          <p className="p-4 text-sm text-muted-foreground">{t("hint")}</p>
        ) : (
          <div className="space-y-4 p-4">
            <dl className="divide-y rounded-md border" data-testid="color-formats">
              {ROWS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3 px-3 py-2">
                  <dt className="w-14 shrink-0 text-xs text-muted-foreground">{label}</dt>
                  <dd className="flex-1 font-mono text-sm break-all" data-testid={`color-${key}`}>
                    {f[key]}
                  </dd>
                  <CopyButton text={f[key]} size="icon-sm" />
                </div>
              ))}
              <div className="flex items-center gap-3 px-3 py-2">
                <dt className="w-14 shrink-0 text-xs text-muted-foreground">{t("name")}</dt>
                <dd className="flex-1 font-mono text-sm" data-testid="color-name">
                  {f.name ?? <span className="text-muted-foreground">{t("nearest", { name: f.nearestName })}</span>}
                </dd>
                {f.name && <CopyButton text={f.name} size="icon-sm" />}
              </div>
            </dl>
            {!f.inGamut && (
              <p className="flex items-start gap-2 text-sm text-warning">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t("outOfGamut")}
              </p>
            )}
          </div>
        )
      }
    />
  );
}
