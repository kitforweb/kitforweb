"use client";

import { useMemo, useState } from "react";
import { CircleAlert, Clock } from "lucide-react";
import { useNow, useTranslations } from "next-intl";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { ToolbarSelect } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppLocale } from "@/hooks/use-app-locale";
import { useToolInput } from "@/hooks/use-tool-input";
import { parseLocalInput, toLocalInput } from "@/lib/utils/time/diff";
import { formatTime, parseTimeInput, type EpochUnit } from "@/lib/utils/time/timestamp";

type UnitOption = EpochUnit | "auto";

export default function TimestampTool() {
  const t = useTranslations("tools.timestamp");
  const tc = useTranslations("common");
  const locale = useAppLocale();
  const now = useNow({ updateInterval: 1000 });
  const [input, setInput] = useToolInput("timestamp", "");
  const [unit, setUnit] = useState<UnitOption>("auto");

  const parsed = useMemo(() => (input.trim() ? parseTimeInput(input, unit) : null), [input, unit]);
  const formats = parsed?.ok ? formatTime(parsed.date, locale, now) : null;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const rows: [string, string][] = formats
    ? [
        [t("seconds"), formats.seconds],
        [t("milliseconds"), formats.milliseconds],
        ["ISO 8601", formats.iso],
        [t("utc"), formats.utc],
        [t("local", { zone }), formats.local],
        [t("relative"), formats.relative],
      ]
    : [];

  return (
    <ToolShell
      toolId="timestamp"
      inputLabel={t("input")}
      outputLabel={t("formats")}
      defaultInputSize={40}
      onExample={() => setInput("1700000000")}
      onClear={() => setInput("")}
      copyText={formats?.iso ?? ""}
      toolbar={
        <ToolbarSelect
          label={t("unit")}
          value={unit}
          onChange={setUnit}
          options={[
            { value: "auto", label: t("auto") },
            { value: "s", label: t("unitS") },
            { value: "ms", label: t("unitMs") },
            { value: "us", label: t("unitUs") },
            { value: "ns", label: t("unitNs") },
          ]}
        />
      }
      input={
        <div className="space-y-5 p-4">
          <section className="space-y-1 rounded-lg border bg-surface-1 p-3" aria-live="off">
            <h3 className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              {t("now")}
            </h3>
            <div className="flex items-center gap-2">
              <p data-testid="now-seconds" className="font-mono text-2xl text-accent-text tabular-nums">
                {Math.floor(now.getTime() / 1000)}
              </p>
              <CopyButton text={() => String(Math.floor(Date.now() / 1000))} size="icon-sm" />
            </div>
            <p className="font-mono text-xs text-muted-foreground tabular-nums">{now.getTime()} ms</p>
          </section>
          <div className="space-y-1.5">
            <Label htmlFor="ts-input" className="text-xs">
              {t("input")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="ts-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="1700000000 · 2024-05-01T10:00:00Z"
                className="font-mono"
                spellCheck={false}
              />
              <Button type="button" variant="outline" onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>
                {t("useNow")}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ts-picker" className="text-xs">
              {t("pick")}
            </Label>
            <Input
              id="ts-picker"
              type="datetime-local"
              value={parsed?.ok ? toLocalInput(parsed.date) : ""}
              onChange={(e) => {
                const d = parseLocalInput(e.target.value);
                if (d) setInput(String(Math.floor(d.getTime() / 1000)));
              }}
              className="w-auto"
            />
          </div>
        </div>
      }
      output={
        !parsed ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : !parsed.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t(`errors.${parsed.error}`)}
          </p>
        ) : (
          <div>
            {parsed.source === "epoch" && (
              <p role="status" className="border-b px-3 py-2 text-xs text-muted-foreground">
                {t("detectedUnit", {
                  unit: t(
                    `unit${parsed.unit === "s" ? "S" : parsed.unit === "ms" ? "Ms" : parsed.unit === "us" ? "Us" : "Ns"}`,
                  ),
                })}
              </p>
            )}
            <dl data-testid="timestamp-formats">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-start gap-3 border-b px-3 py-2.5">
                  <dt className="w-40 shrink-0 text-xs text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 flex-1 font-mono text-[13px] break-all">{value}</dd>
                  <CopyButton text={value} size="icon-sm" />
                </div>
              ))}
              <div className="flex gap-6 px-3 py-2.5 text-xs text-muted-foreground">
                <span>{formats!.dayOfWeek}</span>
                <span>{t("week", { n: formats!.week })}</span>
                <span>{t("dayOfYear", { n: formats!.dayOfYear })}</span>
              </div>
            </dl>
          </div>
        )
      }
    />
  );
}
