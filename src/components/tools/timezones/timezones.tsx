"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { ToolShell } from "@/components/shared/tool-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppLocale } from "@/hooks/use-app-locale";
import { useToolInput } from "@/hooks/use-tool-input";
import { allTimeZones, isTimeZone, timeInZones, toZonedLocalInput, zonedTimeToUtc } from "@/lib/utils/time/zones";
import { cn } from "cn";

const DEFAULT_ZONES = ["UTC", "Europe/Madrid", "America/New_York", "America/Sao_Paulo", "Asia/Tokyo"];

function parseZones(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((z): z is string => typeof z === "string" && isTimeZone(z)) : DEFAULT_ZONES;
  } catch {
    return DEFAULT_ZONES;
  }
}

export default function TimeZones() {
  const t = useTranslations("tools.timezones");
  const locale = useAppLocale();
  const userZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  // The list of zones is remembered; the date is not.
  const [zonesJson, setZonesJson] = useToolInput(
    "timezones",
    JSON.stringify([userZone, ...DEFAULT_ZONES.filter((z) => z !== userZone)]),
    {
      field: "zones",
    },
  );
  const zones = useMemo(() => parseZones(zonesJson), [zonesJson]);
  const [reference, setReference] = useState(userZone);
  const [local, setLocal] = useState(() => toZonedLocalInput(new Date(), userZone));
  const [adding, setAdding] = useState("");
  const all = useMemo(() => allTimeZones(), []);

  const instant = useMemo(() => zonedTimeToUtc(local, reference), [local, reference]);
  const rows = useMemo(
    () => (instant ? timeInZones(instant, zones, locale, reference) : []),
    [instant, zones, locale, reference],
  );

  const setZones = (list: string[]) => setZonesJson(JSON.stringify([...new Set(list)]));
  const add = () => {
    const match =
      all.find((z) => z.toLowerCase() === adding.trim().toLowerCase()) ??
      all.find((z) => z.toLowerCase().includes(adding.trim().toLowerCase().replace(/ /g, "_")));
    if (match) setZones([...zones, match]);
    setAdding("");
  };

  return (
    <ToolShell
      toolId="timezones"
      inputLabel={t("when")}
      outputLabel={t("zones")}
      defaultInputSize={35}
      onExample={() => {
        setReference("Europe/Madrid");
        setLocal("2026-03-10T16:00");
        setZones(["Europe/Madrid", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo"]);
      }}
      onClear={() => setLocal(toZonedLocalInput(new Date(), reference))}
      copyText={rows.map((r) => `${r.city}: ${r.time} (${r.date}, ${r.offset})`).join("\n")}
      input={
        <div className="space-y-5 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="tz-local" className="text-xs">
              {t("dateTime")}
            </Label>
            <Input
              id="tz-local"
              type="datetime-local"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              className="w-auto"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tz-reference" className="text-xs">
              {t("in")}
            </Label>
            <Input
              id="tz-reference"
              list="tz-all"
              value={reference}
              onChange={(e) => isTimeZone(e.target.value) && setReference(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <form
            className="space-y-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Label htmlFor="tz-add" className="text-xs">
              {t("addCity")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="tz-add"
                list="tz-all"
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                placeholder="Tokyo, Europe/Paris…"
                className="text-sm"
              />
              <Button type="submit" variant="outline" aria-label={t("addCity")}>
                <Plus />
              </Button>
            </div>
          </form>
          <datalist id="tz-all">
            {all.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">{t("businessHint")}</p>
        </div>
      }
      output={
        <ul aria-label={t("zones")} data-testid="zone-list" className="divide-y">
          {rows.map((r) => (
            <li key={r.zone} className={cn("flex items-center gap-3 px-3 py-2.5", r.business ? "" : "opacity-70")}>
              <span
                className={cn("size-2 shrink-0 rounded-full", r.business ? "bg-success" : "bg-muted-foreground/40")}
                aria-label={r.business ? t("working") : t("outside")}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.city}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {r.zone} · {r.offset}
                </p>
              </div>
              <div className="text-end">
                <p className="font-mono text-lg tabular-nums">{r.time}</p>
                <p className="text-xs text-muted-foreground">
                  {r.date}
                  {r.dayShift !== 0 && (
                    <span className="ms-1 text-warning">
                      ({r.dayShift > 0 ? "+" : ""}
                      {r.dayShift}d)
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setZones(zones.filter((z) => z !== r.zone))}
                aria-label={t("remove", { city: r.city })}
                className="grid size-6 place-items-center rounded text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      }
    />
  );
}
