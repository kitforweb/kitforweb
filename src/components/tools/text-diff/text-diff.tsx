"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { useDebounced } from "@/hooks/use-debounced";
import { useSettled } from "@/hooks/use-settled";
import { useToolInput } from "@/hooks/use-tool-input";
import { unifiedPatch, type DiffLine, type DiffResult, type DiffRow } from "@/lib/utils/text/diff";
import { runDiffInWorker } from "@/lib/workers";
import { cn } from "cn";

const LEFT = `function total(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.price;
  }
  return sum;
}

export default total;`;

const RIGHT = `function total(items, taxRate = 0) {
  let sum = 0;
  for (const item of items) {
    sum += item.price * item.quantity;
  }
  return sum * (1 + taxRate);
}

export default total;`;

type View = "split" | "inline";

function Content({ line, tone }: { line: DiffLine; tone: "del" | "ins" | null }) {
  return (
    <>
      {line.parts.map((p, i) => (
        <span
          key={i}
          className={cn(
            p.changed && tone === "del" && "rounded-sm bg-destructive/30",
            p.changed && tone === "ins" && "rounded-sm bg-success/30",
          )}
        >
          {p.text}
        </span>
      ))}
    </>
  );
}

const ROW_BG = { del: "bg-destructive/10", ins: "bg-success/10" } as const;

function Cell({ line, tone }: { line?: DiffLine; tone: "del" | "ins" | null }) {
  return (
    <>
      <td className="w-10 border-e px-2 text-end align-top text-muted-foreground select-none">{line?.n}</td>
      <td
        className={cn(
          "px-2 align-top break-all whitespace-pre-wrap",
          line && tone && ROW_BG[tone],
          !line && "bg-muted/40",
        )}
      >
        {line && <Content line={line} tone={tone} />}
      </td>
    </>
  );
}

function SplitRows({ rows, skip }: { rows: DiffRow[]; skip: (n: number) => ReactNode }) {
  return rows.map((r, i) => {
    if (r.kind === "skip") return <tr key={i}>{skip(r.count)}</tr>;
    const left = r.kind === "insert" ? undefined : r.left;
    const right = r.kind === "delete" ? undefined : r.right;
    const changed = r.kind !== "equal";
    return (
      <tr key={i} data-kind={r.kind}>
        <Cell line={left} tone={changed ? "del" : null} />
        <Cell line={right} tone={changed ? "ins" : null} />
      </tr>
    );
  });
}

function InlineRow({
  sign,
  left,
  right,
  line,
  tone,
}: {
  sign: string;
  left?: number;
  right?: number;
  line: DiffLine;
  tone: "del" | "ins" | null;
}) {
  return (
    <tr data-kind={tone ?? "equal"}>
      <td className="w-10 px-2 text-end text-muted-foreground select-none">{left}</td>
      <td className="w-10 border-e px-2 text-end text-muted-foreground select-none">{right}</td>
      <td className={cn("px-2 break-all whitespace-pre-wrap", tone && ROW_BG[tone])}>
        <span className="me-2 text-muted-foreground select-none">{sign}</span>
        <Content line={line} tone={tone} />
      </td>
    </tr>
  );
}

function InlineRows({ rows, skip }: { rows: DiffRow[]; skip: (n: number) => ReactNode }) {
  return rows.flatMap((r, i) => {
    switch (r.kind) {
      case "skip":
        return [<tr key={i}>{skip(r.count)}</tr>];
      case "equal":
        return [<InlineRow key={i} sign=" " left={r.left.n} right={r.right.n} line={r.left} tone={null} />];
      case "delete":
        return [<InlineRow key={i} sign="-" left={r.left.n} line={r.left} tone="del" />];
      case "insert":
        return [<InlineRow key={i} sign="+" right={r.right.n} line={r.right} tone="ins" />];
      case "replace":
        return [
          <InlineRow key={`${i}-d`} sign="-" left={r.left.n} line={r.left} tone="del" />,
          <InlineRow key={`${i}-i`} sign="+" right={r.right.n} line={r.right} tone="ins" />,
        ];
    }
  });
}

export default function TextDiff() {
  const t = useTranslations("tools.text-diff");
  const tc = useTranslations("common");
  const [left, setLeft] = useToolInput("text-diff", "");
  const [right, setRight] = useToolInput("text-diff", "", { field: "right" });
  const [view, setView] = useState<View>("split");
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [onlyChanges, setOnlyChanges] = useState(false);
  const l = useDebounced(left, 250);
  const r = useDebounced(right, 250);

  const computing = useMemo<Promise<DiffResult | { error: string }> | null>(
    () =>
      l.trim() || r.trim()
        ? runDiffInWorker({
            left: l,
            right: r,
            ignoreWhitespace,
            ignoreCase,
            context: onlyChanges ? 3 : undefined,
          }).catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }))
        : null,
    [l, r, ignoreWhitespace, ignoreCase, onlyChanges],
  );
  const { value: result } = useSettled(computing);
  const diff = computing && result && !("error" in result) ? result : null;

  const skip = (count: number) => (
    <td
      colSpan={view === "split" ? 4 : 3}
      className="bg-muted/50 px-3 py-0.5 text-center text-xs text-muted-foreground"
    >
      {t("hidden", { count })}
    </td>
  );

  return (
    <ToolShell
      toolId="text-diff"
      inputLabel={`${t("original")} · ${t("modified")}`}
      outputLabel={t("differences")}
      defaultInputSize={40}
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
      copyText={() => unifiedPatch(left, right)}
      toolbar={
        <>
          <Segmented
            label={t("view")}
            value={view}
            onChange={setView}
            options={[
              { value: "split", label: t("split") },
              { value: "inline", label: t("inline") },
            ]}
          />
          <ToolbarSwitch label={t("ignoreWhitespace")} checked={ignoreWhitespace} onChange={setIgnoreWhitespace} />
          <ToolbarSwitch label={t("ignoreCase")} checked={ignoreCase} onChange={setIgnoreCase} />
          <ToolbarSwitch label={t("onlyChanges")} checked={onlyChanges} onChange={setOnlyChanges} />
        </>
      }
      input={
        <div className="grid h-full min-h-0 grid-rows-2">
          <div className="flex min-h-0 flex-col border-b">
            <div className="shrink-0 bg-surface-1 px-3 py-1 font-mono text-[11px] text-muted-foreground">
              {t("original")}
            </div>
            <div className="min-h-0 flex-1">
              <CodeEditor value={left} onChange={setLeft} ariaLabel={t("original")} placeholder={t("placeholder")} />
            </div>
          </div>
          <div className="flex min-h-0 flex-col">
            <div className="shrink-0 bg-surface-1 px-3 py-1 font-mono text-[11px] text-muted-foreground">
              {t("modified")}
            </div>
            <div className="min-h-0 flex-1">
              <CodeEditor value={right} onChange={setRight} ariaLabel={t("modified")} placeholder={t("placeholder")} />
            </div>
          </div>
        </div>
      }
      output={
        !computing ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : result && "error" in result ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {result.error}
          </p>
        ) : !diff ? null : diff.identical ? (
          <p role="status" className="flex items-center gap-2 p-4 text-sm text-success" data-testid="diff-summary">
            <CircleCheck className="size-4" aria-hidden />
            {t("identical")}
          </p>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <p role="status" className="shrink-0 border-b px-3 py-1.5 font-mono text-xs" data-testid="diff-summary">
              <span className="text-success">+{diff.added}</span>{" "}
              <span className="text-destructive">−{diff.removed}</span>{" "}
              <span className="text-muted-foreground">
                {t("summary", { added: diff.added, removed: diff.removed })}
              </span>
            </p>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse font-mono text-[13px] leading-5" data-testid="diff-table">
                <tbody>
                  {view === "split" ? (
                    <SplitRows rows={diff.rows} skip={skip} />
                  ) : (
                    <InlineRows rows={diff.rows} skip={skip} />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    />
  );
}
