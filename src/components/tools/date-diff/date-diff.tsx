"use client";

import { useId, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented } from "@/components/shared/toolbar-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateDifference, parseLocalInput, shiftDate, toLocalInput, type DurationInput } from "@/lib/utils/time/diff";

const UNITS = ["years", "months", "weeks", "days", "hours", "minutes"] as const;

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-auto"
      />
    </div>
  );
}

export default function DateDiff() {
  const t = useTranslations("tools.date-diff");
  const format = useFormatter();
  const [start, setStart] = useState(() => toLocalInput(new Date()).slice(0, 10) + "T00:00");
  const [end, setEnd] = useState("");
  const [base, setBase] = useState(() => toLocalInput(new Date()));
  const [op, setOp] = useState<"add" | "subtract">("add");
  const [amounts, setAmounts] = useState<Record<(typeof UNITS)[number], string>>({
    years: "",
    months: "",
    weeks: "",
    days: "30",
    hours: "",
    minutes: "",
  });

  const a = parseLocalInput(start);
  const b = parseLocalInput(end);
  const diff = useMemo(() => (a && b ? dateDifference(a, b) : null), [a, b]);
  const baseDate = parseLocalInput(base);
  const shifted = useMemo(() => {
    if (!baseDate) return null;
    const duration: DurationInput = Object.fromEntries(UNITS.map((u) => [u, Number(amounts[u]) || 0]));
    return shiftDate(baseDate, duration, op === "subtract");
  }, [baseDate, amounts, op]);

  const n = (v: number) => format.number(v);

  return (
    <ToolShell
      toolId="date-diff"
      inputLabel={t("between")}
      outputLabel={t("result")}
      onExample={() => {
        setStart("2026-01-01T09:00");
        setEnd("2026-12-24T18:30");
        setBase("2026-01-31T10:00");
        setOp("add");
        setAmounts({ years: "", months: "1", weeks: "", days: "", hours: "", minutes: "" });
      }}
      onClear={() => {
        setEnd("");
        setAmounts({ years: "", months: "", weeks: "", days: "", hours: "", minutes: "" });
      }}
      copyText={diff ? t("summaryDays", { days: diff.totalDays }) : ""}
      input={
        <div className="space-y-6 p-4">
          <section className="space-y-3">
            <h3 className="text-sm font-medium">{t("between")}</h3>
            <DateField label={t("start")} value={start} onChange={setStart} />
            <DateField label={t("end")} value={end} onChange={setEnd} />
          </section>
          <section className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-medium">{t("shiftTitle")}</h3>
            <DateField label={t("from")} value={base} onChange={setBase} />
            <Segmented
              label={t("operation")}
              value={op}
              onChange={setOp}
              options={[
                { value: "add", label: t("add") },
                { value: "subtract", label: t("subtract") },
              ]}
            />
            <div className="grid grid-cols-3 gap-2">
              {UNITS.map((u) => (
                <div key={u} className="space-y-1">
                  <Label htmlFor={`dd-${u}`} className="text-xs text-muted-foreground">
                    {t(`units.${u}`)}
                  </Label>
                  <Input
                    id={`dd-${u}`}
                    type="number"
                    min={0}
                    value={amounts[u]}
                    onChange={(e) => setAmounts((s) => ({ ...s, [u]: e.target.value }))}
                    className="h-8 font-mono text-sm"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      }
      output={
        <div className="divide-y">
          <section className="space-y-3 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground">{t("difference")}</h3>
            {diff ? (
              <>
                <p data-testid="diff-parts" className="text-lg">
                  {diff.negative && "−"}
                  {(["years", "months", "days", "hours", "minutes"] as const)
                    .filter((k) => diff.parts[k] > 0)
                    .map((k) => t(`parts.${k}`, { count: diff.parts[k] }))
                    .join(", ") || t("same")}
                </p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm" data-testid="diff-totals">
                  <dt className="text-muted-foreground">{t("totalDays")}</dt>
                  <dd className="font-mono">{n(diff.totalDays)}</dd>
                  <dt className="text-muted-foreground">{t("totalWeeks")}</dt>
                  <dd className="font-mono">{n(diff.totalWeeks)}</dd>
                  <dt className="text-muted-foreground">{t("totalHours")}</dt>
                  <dd className="font-mono">{n(diff.totalHours)}</dd>
                  <dt className="text-muted-foreground">{t("totalMinutes")}</dt>
                  <dd className="font-mono">{n(diff.totalMinutes)}</dd>
                  <dt className="text-muted-foreground">{t("businessDays")}</dt>
                  <dd className="font-mono">{n(diff.businessDays)}</dd>
                </dl>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("pickBoth")}</p>
            )}
          </section>
          <section className="space-y-2 p-4">
            <h3 className="text-xs font-semibold text-muted-foreground">{t("shiftResult")}</h3>
            {shifted && (
              <p data-testid="shift-result" className="text-lg">
                {format.dateTime(shifted, { dateStyle: "full", timeStyle: "short" })}
              </p>
            )}
            {shifted && (
              <p className="font-mono text-xs text-muted-foreground">{toLocalInput(shifted).replace("T", " ")}</p>
            )}
          </section>
        </div>
      }
    />
  );
}
