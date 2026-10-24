"use client";

import { useMemo, useState } from "react";
import { CircleAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarSelect } from "@/components/shared/toolbar-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppLocale } from "@/hooks/use-app-locale";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { analyzeCron, buildCron, CRON_PRESETS, splitCron, type CronParts } from "@/lib/utils/time/cron";

const FIELDS: (keyof CronParts)[] = ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"];

export default function CronTool() {
  const t = useTranslations("tools.cron");
  const tc = useTranslations("common");
  const locale = useAppLocale();
  const format = useFormatter();
  const [expr, setExpr] = useToolInput("cron", "");
  const [zone, setZone] = useState<"local" | "UTC">("local");
  const debounced = useDebounced(expr, 150);
  const parts = splitCron(expr);

  const result = useMemo(
    () =>
      debounced.trim() ? analyzeCron(debounced, locale, { count: 10, tz: zone === "UTC" ? "UTC" : undefined }) : null,
    [debounced, locale, zone],
  );

  const setPart = (key: keyof CronParts, value: string) => {
    const current = parts ?? { minute: "*", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*" };
    setExpr(buildCron({ ...current, [key]: value }));
  };

  return (
    <ToolShell
      toolId="cron"
      inputLabel={t("expression")}
      outputLabel={t("schedule")}
      onExample={() => setExpr("*/15 9-17 * * 1-5")}
      onClear={() => setExpr("")}
      copyText={expr.trim()}
      toolbar={
        <>
          <ToolbarSelect
            label={t("presets")}
            value={
              (Object.entries(CRON_PRESETS).find(([, v]) => v === expr.trim())?.[0] ?? "custom") as
                keyof typeof CRON_PRESETS | "custom"
            }
            onChange={(k) => k !== "custom" && setExpr(CRON_PRESETS[k])}
            options={[
              { value: "custom" as const, label: t("presets") },
              ...(Object.keys(CRON_PRESETS) as (keyof typeof CRON_PRESETS)[]).map((k) => ({
                value: k,
                label: t(`preset.${k}`),
              })),
            ]}
          />
          <Segmented
            label={t("zone")}
            value={zone}
            onChange={setZone}
            options={[
              { value: "local", label: t("local") },
              { value: "UTC", label: "UTC" },
            ]}
          />
        </>
      }
      input={
        <div className="space-y-5 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="cron-expr" className="text-xs">
              {t("expression")}
            </Label>
            <Input
              id="cron-expr"
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="*/5 * * * *"
              className="font-mono text-lg"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-semibold text-muted-foreground">{t("builder")}</legend>
            <div className="grid grid-cols-5 gap-2">
              {FIELDS.map((f) => (
                <div key={f} className="space-y-1">
                  <Label htmlFor={`cron-${f}`} className="block truncate text-[11px] text-muted-foreground">
                    {t(`fields.${f}`)}
                  </Label>
                  <Input
                    id={`cron-${f}`}
                    value={parts?.[f] ?? ""}
                    onChange={(e) => setPart(f, e.target.value.replace(/\s/g, ""))}
                    placeholder="*"
                    className="h-8 px-2 text-center font-mono text-sm"
                    spellCheck={false}
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">{t("syntaxHint")}</p>
          </fieldset>
        </div>
      }
      output={
        !result ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : !result.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {result.error === "empty" ? tc("emptyHint") : result.error}
          </p>
        ) : (
          <div className="divide-y">
            <p data-testid="cron-description" className="p-4 text-lg leading-7">
              {result.description}
            </p>
            <section className="p-4">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{t("nextRuns")}</h3>
              <ol className="space-y-1 font-mono text-[13px]" data-testid="cron-next">
                {result.next.map((d) => (
                  <li key={d.getTime()}>
                    {format.dateTime(d, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: result.fields === 6 ? "2-digit" : undefined,
                      timeZone: zone === "UTC" ? "UTC" : undefined,
                    })}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )
      }
    />
  );
}
