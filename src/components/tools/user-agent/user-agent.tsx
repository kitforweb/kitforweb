"use client";

import { useMemo, useState } from "react";
import { Bot, Cpu, Globe, Monitor, Smartphone, Tablet } from "lucide-react";
import { useTranslations } from "next-intl";
import { ToolShell } from "@/components/shared/tool-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDebounced } from "@/hooks/use-debounced";
import { initialToolInput, usePersistInput } from "@/hooks/use-tool-input";
import { parseUserAgent } from "@/lib/utils/http/user-agent";

const EXAMPLE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet } as const;

export default function UserAgent() {
  const t = useTranslations("tools.user-agent");
  // By default, show the visitor's own User-Agent.
  const [ua, setUa] = useState(() =>
    initialToolInput("user-agent", typeof navigator === "undefined" ? "" : navigator.userAgent),
  );
  usePersistInput("user-agent", ua);
  const debounced = useDebounced(ua, 150);
  const info = useMemo(() => (debounced.trim() ? parseUserAgent(debounced) : null), [debounced]);
  const DeviceIcon = info ? (DEVICE_ICON[info.device.type as keyof typeof DEVICE_ICON] ?? Monitor) : Monitor;

  const rows: [string, string | undefined][] = info
    ? [
        [t("browser"), [info.browser.name, info.browser.version].filter(Boolean).join(" ")],
        [t("engine"), [info.engine.name, info.engine.version].filter(Boolean).join(" ")],
        [t("os"), [info.os.name, info.os.version].filter(Boolean).join(" ")],
        [
          t("device"),
          [t(`devices.${info.device.type}`), info.device.vendor, info.device.model].filter(Boolean).join(" · "),
        ],
        [t("cpu"), info.cpu],
      ]
    : [];

  return (
    <ToolShell
      toolId="user-agent"
      inputLabel="User-Agent"
      outputLabel={t("result")}
      onExample={() => setUa(EXAMPLE)}
      onClear={() => setUa("")}
      copyText={rows.map(([k, v]) => `${k}: ${v ?? "—"}`).join("\n")}
      toolbar={
        <Button type="button" variant="ghost" size="sm" onClick={() => setUa(navigator.userAgent)}>
          <Globe />
          {t("mine")}
        </Button>
      }
      input={
        <div className="p-4">
          <Textarea
            value={ua}
            onChange={(e) => setUa(e.target.value)}
            aria-label="User-Agent"
            placeholder="Mozilla/5.0 (…)"
            className="min-h-40 font-mono text-[13px]"
            spellCheck={false}
          />
        </div>
      }
      output={
        !info ? (
          <p className="p-4 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <DeviceIcon className="size-10 text-primary" aria-hidden />
              <div>
                <p className="text-lg font-semibold" data-testid="ua-summary">
                  {[info.browser.name, info.browser.major].filter(Boolean).join(" ") || t("unknown")} ·{" "}
                  {info.os.name ?? t("unknown")}
                </p>
                <p className="text-sm text-muted-foreground">{t(`devices.${info.device.type}`)}</p>
              </div>
            </div>
            {info.bot && (
              <p className="flex items-center gap-2 rounded-md bg-warning/10 p-2 text-sm text-warning" role="status">
                <Bot className="size-4" aria-hidden />
                {t("bot", { name: info.bot })}
              </p>
            )}
            <dl className="divide-y rounded-md border" data-testid="ua-details">
              {rows.map(([k, v]) => (
                <div key={k} className="flex gap-3 px-3 py-2 text-sm">
                  <dt className="w-32 shrink-0 text-muted-foreground">{k}</dt>
                  <dd className="font-mono">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Cpu className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {t("hint")}
            </p>
          </div>
        )
      }
    />
  );
}
