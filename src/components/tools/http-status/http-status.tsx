"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented } from "@/components/shared/toolbar-controls";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToolInput } from "@/hooks/use-tool-input";
import { findStatus, statusClass, statusCodes, type StatusClass } from "@/lib/utils/http/status";
import { matchesQuery } from "@/lib/utils/search/match";
import { cn } from "cn";

const CLASS_STYLE: Record<StatusClass, string> = {
  informational: "text-muted-foreground",
  success: "text-success",
  redirection: "text-accent-text",
  client: "text-warning",
  server: "text-destructive",
};

type Filter = "all" | StatusClass;

export default function HttpStatus() {
  const t = useTranslations("tools.http-status");
  // The search box is the main input: the detector hands off codes like "404".
  const [query, setQuery] = useToolInput("http-status", "");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState(() => (findStatus(Number(query.trim())) ? Number(query.trim()) : 200));

  const visible = useMemo(
    () =>
      statusCodes.filter(
        (s) =>
          (filter === "all" || statusClass(s.code) === filter) &&
          matchesQuery(query, [String(s.code), s.name, t(`codes.${s.code}`)]),
      ),
    [query, filter, t],
  );
  const current = findStatus(selected) ?? statusCodes[4];
  const cls = statusClass(current.code)!;

  return (
    <ToolShell
      toolId="http-status"
      inputLabel={t("codes_title")}
      outputLabel={`${current.code} ${current.name}`}
      defaultInputSize={40}
      onExample={() => {
        setQuery("429");
        setSelected(429);
      }}
      onClear={() => {
        setQuery("");
        setFilter("all");
      }}
      copyText={`${current.code} ${current.name}`}
      toolbar={
        <Segmented
          label={t("class")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("all") },
            { value: "informational", label: "1xx" },
            { value: "success", label: "2xx" },
            { value: "redirection", label: "3xx" },
            { value: "client", label: "4xx" },
            { value: "server", label: "5xx" },
          ]}
        />
      }
      input={
        <div className="flex h-full min-h-0 flex-col">
          <div className="relative shrink-0 border-b p-2">
            <Search
              className="pointer-events-none absolute inset-y-0 start-4 my-auto size-3.5 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                const code = Number(e.target.value.trim());
                if (findStatus(code)) setSelected(code);
              }}
              placeholder={t("search")}
              aria-label={t("search")}
              className="h-8 ps-7 text-xs"
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-1" aria-label={t("codes_title")} data-testid="status-list">
            {visible.map((s) => (
              <li key={s.code}>
                <button
                  type="button"
                  onClick={() => setSelected(s.code)}
                  aria-current={s.code === current.code ? "true" : undefined}
                  className={cn(
                    "flex w-full items-baseline gap-3 rounded-md px-3 py-1.5 text-start hover:bg-surface-3",
                    s.code === current.code && "bg-accent shadow-[inset_2px_0_0_var(--primary)]",
                  )}
                >
                  <span className={cn("font-mono text-sm font-semibold", CLASS_STYLE[statusClass(s.code)!])}>
                    {s.code}
                  </span>
                  <span className="truncate text-sm">{s.name}</span>
                </button>
              </li>
            ))}
            {visible.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">{t("noResults")}</li>}
          </ul>
        </div>
      }
      output={
        <article className="space-y-4 p-5" data-testid="status-detail">
          <header className="space-y-1">
            <p className={cn("font-mono text-4xl font-bold", CLASS_STYLE[cls])}>{current.code}</p>
            <h3 className="text-xl font-semibold">{current.name}</h3>
            <Badge variant="outline">{t(`classes.${cls}`)}</Badge>
          </header>
          <p className="leading-7">{t(`codes.${current.code}`)}</p>
          <p className="rounded-md bg-surface-1 p-3 text-sm leading-6 text-muted-foreground">{t(`classHint.${cls}`)}</p>
        </article>
      }
    />
  );
}
