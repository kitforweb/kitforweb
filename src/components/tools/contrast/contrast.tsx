"use client";

import { useMemo } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import { ColorField } from "@/components/shared/color-field";
import { ToolShell } from "@/components/shared/tool-shell";
import { Button } from "@/components/ui/button";
import { useToolInput } from "@/hooks/use-tool-input";
import { contrastReport, parseColor, suggestForeground } from "@/lib/utils/css/color";
import { cn } from "cn";

function Badge({ label, pass }: { label: string; pass: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm",
        pass ? "border-success/40 text-success" : "border-destructive/40 text-destructive",
      )}
      data-pass={pass}
    >
      {label}
      {pass ? <CircleCheck className="size-4" aria-label="pass" /> : <CircleX className="size-4" aria-label="fail" />}
    </li>
  );
}

export default function Contrast() {
  const t = useTranslations("tools.contrast");
  const [fgText, setFg] = useToolInput("contrast", "");
  const [bgText, setBg] = useToolInput("contrast", "", { field: "bg" });
  const fg = useMemo(() => parseColor(fgText), [fgText]);
  const bg = useMemo(() => parseColor(bgText), [bgText]);
  const report = fg && bg ? contrastReport(fg, bg) : null;
  const suggestions =
    fg && bg && report
      ? (
          [
            ["AA", 4.5],
            ["AAA", 7],
          ] as const
        )
          .filter(([, target]) => report.ratio < target)
          .map(([level, target]) => ({ level, target, color: suggestForeground(fg, bg, target) }))
      : [];

  return (
    <ToolShell
      toolId="contrast"
      inputLabel={t("colors")}
      outputLabel={t("result")}
      defaultInputSize={40}
      onExample={() => {
        setFg("#8b8b8b");
        setBg("#ffffff");
      }}
      onClear={() => {
        setFg("");
        setBg("");
      }}
      onSwap={() => {
        setFg(bgText);
        setBg(fgText);
      }}
      copyText={report ? `${report.ratio}:1` : ""}
      input={
        <div className="space-y-4 p-4">
          <ColorField label={t("foreground")} value={fgText} onChange={setFg} />
          <ColorField label={t("background")} value={bgText} onChange={setBg} />
          <p className="text-xs text-muted-foreground">{t("rules")}</p>
        </div>
      }
      output={
        !report ? (
          <p className="p-4 text-sm text-muted-foreground">{t("hint")}</p>
        ) : (
          <div className="space-y-5 p-4">
            <div
              className="rounded-lg border p-5"
              style={{ color: fgText, background: bgText }}
              data-testid="contrast-preview"
            >
              <p className="text-2xl font-semibold">{t("sampleLarge")}</p>
              <p className="mt-2 text-sm">{t("sampleNormal")}</p>
            </div>
            <p className="font-mono text-4xl tabular-nums" data-testid="contrast-ratio">
              {report.ratio}:1
            </p>
            <ul className="grid grid-cols-2 gap-2" data-testid="contrast-levels">
              <Badge label={t("normalAA")} pass={report.normal.AA} />
              <Badge label={t("normalAAA")} pass={report.normal.AAA} />
              <Badge label={t("largeAA")} pass={report.large.AA} />
              <Badge label={t("largeAAA")} pass={report.large.AAA} />
              <Badge label={t("ui")} pass={report.ui} />
            </ul>
            {suggestions.length > 0 && (
              <section className="space-y-2" data-testid="contrast-suggestions">
                <h3 className="text-xs font-semibold text-muted-foreground">{t("suggestions")}</h3>
                {suggestions.map(({ level, target, color }) =>
                  color ? (
                    <div key={level} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                      <span className="size-6 shrink-0 rounded border" style={{ background: color }} aria-hidden />
                      <span className="flex-1">
                        {t("suggestion", { level, target })} <code className="font-mono">{color}</code>
                      </span>
                      <Button type="button" variant="secondary" size="sm" onClick={() => setFg(color)}>
                        {t("apply")}
                      </Button>
                    </div>
                  ) : (
                    <p key={level} className="text-sm text-muted-foreground">
                      {t("impossible", { level })}
                    </p>
                  ),
                )}
              </section>
            )}
          </div>
        )
      }
    />
  );
}
