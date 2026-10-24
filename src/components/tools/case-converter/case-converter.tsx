"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { CASE_LABELS, caseStyles, convertCase, detectCase } from "@/lib/utils/text/case";
import { cn } from "cn";

const EXAMPLE = `user_first_name
getHTTPResponseCode
billing-address
MAX_RETRY_COUNT
Order Line Item`;

export default function CaseConverter() {
  const t = useTranslations("tools.case-converter");
  const tc = useTranslations("common");
  const [text, setText] = useToolInput("case-converter", "");
  const debounced = useDebounced(text, 100);
  const firstLine = debounced.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const current = detectCase(firstLine);

  const results = useMemo(
    () => (debounced.trim() ? caseStyles.map((style) => ({ style, value: convertCase(debounced, style) })) : []),
    [debounced],
  );

  return (
    <ToolShell
      toolId="case-converter"
      inputLabel={t("input")}
      outputLabel={t("output")}
      onExample={() => setText(EXAMPLE)}
      onClear={() => setText("")}
      copyText={results.find((r) => r.style === "camel")?.value ?? ""}
      input={<CodeEditor value={text} onChange={setText} ariaLabel={t("input")} placeholder={t("placeholder")} />}
      output={
        results.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : (
          <ul className="divide-y overflow-auto" data-testid="case-results">
            {results.map(({ style, value }) => (
              <li key={style} className={cn("flex items-start gap-3 px-3 py-2", style === current && "bg-primary/5")}>
                <span className="w-32 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
                  {CASE_LABELS[style]}
                  {style === current && <span className="block text-[10px] text-accent-text">{t("current")}</span>}
                </span>
                <pre
                  className="min-w-0 flex-1 font-mono text-sm break-all whitespace-pre-wrap"
                  data-testid={`case-${style}`}
                >
                  {value}
                </pre>
                <CopyButton text={value} size="icon-sm" />
              </li>
            ))}
          </ul>
        )
      }
    />
  );
}
