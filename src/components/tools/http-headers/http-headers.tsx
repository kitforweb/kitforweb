"use client";

import { useMemo } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { ToolShell } from "@/components/shared/tool-shell";
import { Badge } from "@/components/ui/badge";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { analyzeHeaders, type HeaderIssue } from "@/lib/utils/http/headers";
import { cn } from "cn";

const EXAMPLE = `HTTP/2 200
date: Tue, 10 Mar 2026 09:00:00 GMT
content-type: text/html; charset=utf-8
cache-control: public, max-age=600
server: nginx/1.25.3
x-powered-by: Express
set-cookie: session=3f9a1c; Path=/; HttpOnly
access-control-allow-origin: *
strict-transport-security: max-age=31536000
x-content-type-options: nosniff
vary: Accept-Encoding`;

const SEVERITY: Record<HeaderIssue["severity"], { icon: typeof CircleAlert; className: string }> = {
  high: { icon: CircleAlert, className: "text-destructive" },
  medium: { icon: TriangleAlert, className: "text-warning" },
  low: { icon: Info, className: "text-muted-foreground" },
};

export default function HttpHeaders() {
  const t = useTranslations("tools.http-headers");
  const tc = useTranslations("common");
  const [input, setInput] = useToolInput("http-headers", "");
  const debounced = useDebounced(input, 200);
  const analysis = useMemo(() => (debounced.trim() ? analyzeHeaders(debounced) : null), [debounced]);

  return (
    <ToolShell
      toolId="http-headers"
      inputLabel={t("raw")}
      outputLabel={t("analysis")}
      onExample={() => setInput(EXAMPLE)}
      onClear={() => setInput("")}
      copyText={analysis ? analysis.issues.map((i) => t(`issues.${i.id}`, { detail: i.detail ?? "" })).join("\n") : ""}
      input={<CodeEditor value={input} onChange={setInput} ariaLabel={t("raw")} placeholder={t("placeholder")} />}
      output={
        !analysis ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : (
          <div className="divide-y">
            <section className="p-3" aria-label={t("findings")}>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{t("findings")}</h3>
              {analysis.issues.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-success" role="status">
                  <CircleCheck className="size-4" aria-hidden />
                  {t("allGood")}
                </p>
              ) : (
                <ul className="space-y-1.5" data-testid="header-issues">
                  {analysis.issues.map((issue, i) => {
                    const { icon: Icon, className } = SEVERITY[issue.severity];
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Icon
                          className={cn("mt-0.5 size-4 shrink-0", className)}
                          aria-label={t(`severity.${issue.severity}`)}
                        />
                        <span>{t(`issues.${issue.id}`, { detail: issue.detail ?? "" })}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            {analysis.status && (
              <p className="px-3 py-2 font-mono text-sm">
                {analysis.status.version} <strong>{analysis.status.code}</strong> {analysis.status.text}
              </p>
            )}
            <ul aria-label={t("headers")} data-testid="header-list">
              {analysis.headers.map((h, i) => (
                <li key={i} className="space-y-1 border-b px-3 py-2 last:border-b-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-[13px] font-semibold text-[var(--syntax-key)]">{h.name}</span>
                    {h.category && (
                      <Badge variant="outline" className="text-[10px]">
                        {t(`categories.${h.category}`)}
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-xs break-all">{h.value}</p>
                  {t.has(`explain.${h.key}`) && (
                    <p className="text-xs leading-5 text-muted-foreground">{t(`explain.${h.key}`)}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      }
    />
  );
}
