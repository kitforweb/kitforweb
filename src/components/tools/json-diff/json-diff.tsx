"use client";

import { useMemo } from "react";
import { CircleAlert, CircleCheck, Minus, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { ToolShell } from "@/components/shared/tool-shell";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { diffJson, summarize, type DiffEntry, type DiffKind } from "@/lib/utils/json/diff";
import type { ConvertResult } from "@/lib/utils/convert/result";
import { parseJsonStrict } from "@/lib/utils/json/parse";
import { cn } from "cn";

const LEFT = `{
  "name": "kitforweb",
  "version": "1.0.0",
  "user": { "name": "Ada", "address": { "city": "London", "zip": "W1" } },
  "features": ["json", "jwt"],
  "beta": true
}`;

const RIGHT = `{
  "version": "1.1.0",
  "name": "kitforweb",
  "user": { "name": "Ada", "address": { "city": "Paris", "zip": "W1" } },
  "features": ["json", "jwt", "yaml"],
  "license": "MIT"
}`;

const style: Record<DiffKind, { icon: typeof Plus; className: string }> = {
  added: { icon: Plus, className: "text-success" },
  removed: { icon: Minus, className: "text-destructive" },
  changed: { icon: Pencil, className: "text-warning" },
};

const position = (r: ConvertResult) => (r.ok ? {} : { line: r.line, column: r.column });

const show = (v: unknown) => {
  const s = JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
};

function Row({ entry }: { entry: DiffEntry }) {
  const t = useTranslations("tools.json-diff");
  const { icon: Icon, className } = style[entry.kind];
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-3 border-b px-3 py-2 font-mono text-[13px] last:border-b-0">
      <Icon className={cn("mt-0.5 size-4", className)} aria-label={t(entry.kind)} />
      <div className="min-w-0">
        <div className="break-all text-foreground">{entry.path}</div>
        <div className="mt-0.5 break-all text-muted-foreground">
          {entry.kind === "changed" ? (
            <>
              <span className="text-destructive line-through">{show(entry.before)}</span> →{" "}
              <span className="text-success">{show(entry.after)}</span>
            </>
          ) : entry.kind === "added" ? (
            <span className="text-success">{show(entry.after)}</span>
          ) : (
            <span className="text-destructive line-through">{show(entry.before)}</span>
          )}
        </div>
      </div>
    </li>
  );
}

export default function JsonDiff() {
  const t = useTranslations("tools.json-diff");
  const tc = useTranslations("common");
  const [left, setLeft] = useToolInput("json-diff", "", { field: "left" });
  const [right, setRight] = useToolInput("json-diff", "", { field: "right" });
  const a = useDebounced(left, 250);
  const b = useDebounced(right, 250);

  const result = useMemo(() => {
    if (!a.trim() || !b.trim()) return null;
    const pa = parseJsonStrict(a);
    if (!pa.ok) return { error: t("errorIn", { side: t("original") }), ...position(pa.result) };
    const pb = parseJsonStrict(b);
    if (!pb.ok) return { error: t("errorIn", { side: t("modified") }), ...position(pb.result) };
    return { entries: diffJson(pa.value, pb.value) };
  }, [a, b, t]);

  const entries = result && "entries" in result ? result.entries : null;
  const counts = entries ? summarize(entries) : null;

  return (
    <ToolShell
      toolId="json-diff"
      inputLabel={`${t("original")} · ${t("modified")}`}
      outputLabel={t("differences")}
      onExample={() => {
        setLeft(LEFT);
        setRight(RIGHT);
      }}
      onClear={() => {
        setLeft("");
        setRight("");
      }}
      onSwap={() => {
        setLeft(right);
        setRight(left);
      }}
      copyText={entries ? JSON.stringify(entries, null, 2) : ""}
      input={
        <div className="grid h-full min-h-0 grid-rows-2">
          {(
            [
              ["original.json", left, setLeft, t("original")],
              ["modified.json", right, setRight, t("modified")],
            ] as const
          ).map(([file, value, set, label]) => (
            <div key={file} className="flex min-h-0 flex-col border-b last:border-b-0">
              <div className="shrink-0 bg-surface-1 px-3 py-1 font-mono text-[11px] text-muted-foreground">{file}</div>
              <div className="min-h-0 flex-1">
                <CodeEditor
                  value={value}
                  onChange={set}
                  language="json"
                  ariaLabel={label}
                  placeholder={t("placeholder")}
                />
              </div>
            </div>
          ))}
        </div>
      }
      output={
        !result ? (
          <p className="p-4 text-sm text-muted-foreground">{t("hint")}</p>
        ) : "error" in result ? (
          <p role="alert" className="flex items-start gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {result.error}
              {result.line !== undefined && (
                <span className="ms-2 font-mono text-xs text-muted-foreground">
                  {tc("position", { line: result.line, column: result.column ?? 1 })}
                </span>
              )}
            </span>
          </p>
        ) : entries && entries.length === 0 ? (
          <p role="status" className="flex items-center gap-2 p-4 text-sm text-success">
            <CircleCheck className="size-4" aria-hidden />
            {t("identical")}
          </p>
        ) : (
          <div>
            <p role="status" className="flex flex-wrap gap-3 border-b px-3 py-2 text-xs">
              <span className="text-success">{t("addedCount", { count: counts!.added })}</span>
              <span className="text-destructive">{t("removedCount", { count: counts!.removed })}</span>
              <span className="text-warning">{t("changedCount", { count: counts!.changed })}</span>
            </p>
            <ul aria-label={t("differences")}>
              {entries!.map((e) => (
                <Row key={`${e.kind}:${e.path}`} entry={e} />
              ))}
            </ul>
          </div>
        )
      }
    />
  );
}
