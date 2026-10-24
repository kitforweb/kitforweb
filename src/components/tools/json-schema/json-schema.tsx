"use client";

import { useMemo } from "react";
import { CircleAlert, CircleCheck, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor, type EditorDiagnostic } from "@/components/shared/code-editor";
import { ToolShell } from "@/components/shared/tool-shell";
import { Button } from "@/components/ui/button";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { generateSchema, validateJsonSchema } from "@/lib/utils/api/json-schema";

const SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id", "email", "plan"],
  "properties": {
    "id": { "type": "integer", "minimum": 1 },
    "email": { "type": "string", "format": "email" },
    "plan": { "enum": ["free", "pro", "team"] },
    "seats": { "type": "integer", "minimum": 1, "maximum": 500 }
  },
  "additionalProperties": false
}`;

const DATA = `{
  "id": 42,
  "email": "ada@example",
  "plan": "enterprise",
  "seats": 0,
  "trial": true
}`;

export default function JsonSchemaTool() {
  const t = useTranslations("tools.json-schema");
  const tc = useTranslations("common");
  const [schema, setSchema] = useToolInput("json-schema", "");
  const [data, setData] = useToolInput("json-schema", "", { field: "data" });
  const s = useDebounced(schema, 250);
  const d = useDebounced(data, 250);
  const result = useMemo(() => (s.trim() && d.trim() ? validateJsonSchema(s, d) : null), [s, d]);

  const diagnostics = useMemo<EditorDiagnostic[]>(
    () =>
      result?.ok && !result.valid
        ? result.errors
            .filter((e) => e.offset !== undefined)
            .map((e) => ({ from: e.offset!, to: e.offset! + (e.length ?? 1), message: `${e.path}: ${e.message}` }))
        : [],
    [result],
  );

  const generate = () => {
    const g = generateSchema(data);
    if (g.ok) setSchema(g.schema);
  };

  return (
    <ToolShell
      toolId="json-schema"
      inputLabel={`${t("schema")} · ${t("data")}`}
      outputLabel={t("result")}
      onExample={() => {
        setSchema(SCHEMA);
        setData(DATA);
      }}
      onClear={() => {
        setSchema("");
        setData("");
      }}
      copyText={result?.ok && !result.valid ? result.errors.map((e) => `${e.path}: ${e.message}`).join("\n") : ""}
      toolbar={
        <Button type="button" variant="ghost" size="sm" onClick={generate} disabled={!data.trim()}>
          <Wand2 />
          {t("generate")}
        </Button>
      }
      input={
        <div className="grid h-full min-h-0 grid-rows-2">
          <div className="flex min-h-0 flex-col border-b">
            <div className="shrink-0 bg-surface-1 px-3 py-1 font-mono text-[11px] text-muted-foreground">
              schema.json
            </div>
            <div className="min-h-0 flex-1">
              <CodeEditor
                value={schema}
                onChange={setSchema}
                language="json"
                ariaLabel={t("schema")}
                placeholder={t("schemaPlaceholder")}
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-col">
            <div className="shrink-0 bg-surface-1 px-3 py-1 font-mono text-[11px] text-muted-foreground">data.json</div>
            <div className="min-h-0 flex-1">
              <CodeEditor
                value={data}
                onChange={setData}
                language="json"
                diagnostics={diagnostics}
                ariaLabel={t("data")}
                placeholder={t("dataPlaceholder")}
              />
            </div>
          </div>
        </div>
      }
      output={
        !result ? (
          <p className="p-4 text-sm text-muted-foreground">{t("hint")}</p>
        ) : !result.ok ? (
          <p role="alert" className="flex items-start gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {t(`errors.${result.error}`)}
              {result.line !== undefined && (
                <span className="ms-2 font-mono text-xs text-muted-foreground">
                  {tc("position", { line: result.line, column: result.column ?? 1 })}
                </span>
              )}
              <span className="mt-1 block font-mono text-xs">{result.message}</span>
            </span>
          </p>
        ) : result.valid ? (
          <p role="status" className="flex items-center gap-2 p-4 text-sm text-success">
            <CircleCheck className="size-4" aria-hidden />
            {t("valid")}
          </p>
        ) : (
          <div>
            <p role="status" className="flex items-center gap-2 border-b px-3 py-2 text-sm text-destructive">
              <CircleAlert className="size-4" aria-hidden />
              {t("invalid", { count: result.errors.length })}
            </p>
            <ol className="divide-y" data-testid="schema-errors">
              {result.errors.map((e, i) => (
                <li key={i} className="space-y-0.5 px-3 py-2">
                  <p className="font-mono text-[13px] text-[var(--syntax-key)]">
                    {e.path}
                    {e.line !== undefined && (
                      <span className="ms-2 text-xs text-muted-foreground">
                        {tc("position", { line: e.line, column: e.column ?? 1 })}
                      </span>
                    )}
                  </p>
                  <p className="text-sm">{e.message}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{e.keyword}</p>
                </li>
              ))}
            </ol>
          </div>
        )
      }
    />
  );
}
