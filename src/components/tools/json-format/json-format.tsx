"use client";

import { useMemo, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor, type EditorDiagnostic } from "@/components/shared/code-editor";
import { FileDrop, FileOpenButton } from "@/components/shared/file-drop";
import { ToolShell } from "@/components/shared/tool-shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { analyzeJson, formatJson, minifyJson, sortKeys, type IndentOption } from "@/lib/utils/json/analyze";
import { cn } from "cn";
import { JsonTree } from "./json-tree";

const EXAMPLE = `{
  "name": "kitforweb",
  "version": "1.0.0",
  "private": true,
  "tags": ["json", "formatter", "validator"],
  "author": { "name": "Ada", "email": "ada@example.com" },
  "stars": 4.9,
  "license": null
}`;

type Mode = "format" | "minify";
type View = "code" | "tree";

export default function JsonFormat() {
  const t = useTranslations("tools.json-format");
  const tc = useTranslations("common");
  const [input, setInput] = useToolInput("json-format", "");
  const [mode, setMode] = useState<Mode>("format");
  const [indent, setIndent] = useState<IndentOption>(2);
  const [sorted, setSorted] = useState(false);
  const [view, setView] = useState<View>("code");

  const debounced = useDebounced(input, 150);
  const analysis = useMemo(() => analyzeJson(debounced), [debounced]);

  const output = useMemo(() => {
    if (!analysis.ok) return "";
    const value = sorted ? sortKeys(analysis.value) : analysis.value;
    return mode === "minify" ? minifyJson(value) : formatJson(value, indent);
  }, [analysis, mode, indent, sorted]);

  const issues = useMemo(() => (analysis.ok ? [] : analysis.issues), [analysis]);
  const diagnostics = useMemo<EditorDiagnostic[]>(
    () =>
      issues.map((i) => ({
        from: i.offset,
        to: i.offset + i.length,
        message: t(`errors.${i.code}`),
      })),
    [issues, t],
  );

  const empty = debounced.trim() === "";

  return (
    <ToolShell
      toolId="json-format"
      inputLabel="input.json"
      outputLabel={mode === "minify" ? "output.min.json" : "output.json"}
      onExample={() => setInput(EXAMPLE)}
      onClear={() => setInput("")}
      onSwap={output ? () => setInput(output) : undefined}
      copyText={output}
      inputActions={<FileOpenButton accept=".json,application/json" onText={setInput} />}
      toolbar={
        <>
          <div role="radiogroup" aria-label={t("mode")} className="flex rounded-md bg-background p-0.5">
            {(["format", "minify"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                size="xs"
                variant={mode === m ? "secondary" : "ghost"}
                onClick={() => setMode(m)}
              >
                {t(m)}
              </Button>
            ))}
          </div>
          {mode === "format" && (
            <Select value={String(indent)} onValueChange={(v) => setIndent(v === "tab" ? "tab" : (Number(v) as 2 | 4))}>
              <SelectTrigger size="sm" className="h-7 w-auto gap-1 text-xs" aria-label={t("indent")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">{t("spaces", { n: 2 })}</SelectItem>
                <SelectItem value="4">{t("spaces", { n: 4 })}</SelectItem>
                <SelectItem value="tab">{t("tab")}</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-2 px-2">
            <Switch id="json-sort" checked={sorted} onCheckedChange={setSorted} size="sm" />
            <Label htmlFor="json-sort" className="text-xs font-normal">
              {t("sortKeys")}
            </Label>
          </div>
        </>
      }
      outputActions={
        analysis.ok && (
          <div role="radiogroup" aria-label={t("view")} className="flex">
            {(["code", "tree"] as const).map((v) => (
              <Button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                size="xs"
                variant={view === v ? "secondary" : "ghost"}
                onClick={() => setView(v)}
              >
                {t(v)}
              </Button>
            ))}
          </div>
        )
      }
      input={
        <FileDrop onText={setInput}>
          <CodeEditor
            value={input}
            onChange={setInput}
            language="json"
            diagnostics={diagnostics}
            ariaLabel={t("inputLabel")}
            placeholder={t("placeholder")}
          />
        </FileDrop>
      }
      output={
        <div className="flex h-full min-h-0 flex-col">
          {!empty && (
            <div
              role="status"
              className={cn(
                "flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-xs",
                analysis.ok ? "text-success" : "text-destructive",
              )}
            >
              {analysis.ok ? (
                <CircleCheck className="size-4" aria-hidden />
              ) : (
                <CircleAlert className="size-4" aria-hidden />
              )}
              {analysis.ok ? t("valid") : t("invalid", { count: issues.length })}
            </div>
          )}
          {empty ? (
            <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
          ) : !analysis.ok ? (
            <ol className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[13px]" aria-label={t("errorList")}>
              {issues.map((i, n) => (
                <li key={n} className="flex gap-3 rounded px-2 py-1.5 hover:bg-muted">
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {t("position", { line: i.line, column: i.column })}
                  </span>
                  <span className="text-foreground">{t(`errors.${i.code}`)}</span>
                </li>
              ))}
            </ol>
          ) : view === "tree" ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <JsonTree value={sorted ? sortKeys(analysis.value) : analysis.value} />
            </div>
          ) : (
            <div className="min-h-0 flex-1">
              <CodeEditor
                value={output}
                language="json"
                readOnly
                lineWrapping={mode === "minify"}
                ariaLabel={t("outputLabel")}
                reportStatus={false}
              />
            </div>
          )}
        </div>
      }
    />
  );
}
