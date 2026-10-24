"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Segmented, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findNode, updateNode, type Quantifier, type RegexNode } from "@/lib/utils/regex/blocks";

type RepeatKind = "once" | "optional" | "oneOrMore" | "zeroOrMore" | "custom";

function repeatKind(q: Quantifier | undefined): RepeatKind {
  if (!q || (q.min === 1 && q.max === 1)) return "once";
  if (q.min === 0 && q.max === 1) return "optional";
  if (q.min === 1 && q.max === null) return "oneOrMore";
  if (q.min === 0 && q.max === null) return "zeroOrMore";
  return "custom";
}

const PRESETS: Record<Exclude<RepeatKind, "custom">, Quantifier | undefined> = {
  once: undefined,
  optional: { min: 0, max: 1 },
  oneOrMore: { min: 1, max: null },
  zeroOrMore: { min: 0, max: null },
};

function Field({
  label,
  value,
  onChange,
  width = "w-full",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  width?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 font-mono text-xs ${width}`}
        spellCheck={false}
      />
    </div>
  );
}

/** Settings of the selected block: its content and how many times it repeats. */
export function BlockEditor({
  nodes,
  selected,
  onChange,
}: {
  nodes: RegexNode[];
  selected: string | null;
  onChange: (nodes: RegexNode[], record?: boolean) => void;
}) {
  const t = useTranslations("tools.regex-builder");
  const tr = useTranslations("regex");
  const node = selected ? findNode(nodes, selected) : null;
  if (!node) return <p className="text-xs text-muted-foreground">{t("selectHint")}</p>;

  // Typing does not create one undo step per key.
  const patch = (p: Partial<RegexNode>, record = false) => onChange(updateNode(nodes, node.id, p), record);
  const repeatable = !["start", "end", "boundary"].includes(node.type);
  const kind = repeatKind(node.quantifier);

  return (
    <div className="space-y-3" data-testid="block-editor">
      <h3 className="text-sm font-medium">{tr(`blocks.${node.type}`)}</h3>
      {node.type === "literal" && <Field label={t("text")} value={node.value} onChange={(value) => patch({ value })} />}
      {node.type === "charset" && (
        <>
          <Field label={t("chars")} value={node.chars} onChange={(chars) => patch({ chars })} />
          <p className="text-[11px] text-muted-foreground">{t("charsHint")}</p>
          <ToolbarSwitch label={t("negate")} checked={node.negate} onChange={(negate) => patch({ negate }, true)} />
        </>
      )}
      {node.type === "group" && (
        <>
          <ToolbarSwitch label={t("capture")} checked={node.capture} onChange={(capture) => patch({ capture }, true)} />
          {node.capture && (
            <Field
              label={t("name")}
              value={node.name ?? ""}
              onChange={(name) => patch({ name: name.replace(/[^\w]/g, "") || undefined })}
            />
          )}
        </>
      )}
      {node.type === "raw" && <Field label={t("code")} value={node.source} onChange={(source) => patch({ source })} />}
      {repeatable && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t("repeat")}</Label>
          <Segmented
            label={t("repeat")}
            value={kind}
            onChange={(k) => patch({ quantifier: k === "custom" ? { min: 2, max: 4 } : PRESETS[k] }, true)}
            options={[
              { value: "once", label: t("once") },
              { value: "optional", label: "0–1" },
              { value: "oneOrMore", label: "1+" },
              { value: "zeroOrMore", label: "0+" },
              { value: "custom", label: t("custom") },
            ]}
          />
          {kind === "custom" && node.quantifier && (
            <div className="flex items-end gap-2">
              <Field
                label={t("min")}
                width="w-20"
                value={String(node.quantifier.min)}
                onChange={(v) => patch({ quantifier: { ...node.quantifier!, min: Math.max(0, Number(v) || 0) } })}
              />
              <Field
                label={t("max")}
                width="w-20"
                value={node.quantifier.max === null ? "" : String(node.quantifier.max)}
                onChange={(v) =>
                  patch({
                    quantifier: { ...node.quantifier!, max: v.trim() === "" ? null : Math.max(0, Number(v) || 0) },
                  })
                }
              />
              <span className="pb-2 text-[11px] text-muted-foreground">{t("emptyIsInfinite")}</span>
            </div>
          )}
          {kind !== "once" && (
            <ToolbarSwitch
              label={tr("quantifier.lazy")}
              checked={Boolean(node.quantifier?.lazy)}
              onChange={(lazy) => patch({ quantifier: { ...node.quantifier!, lazy: lazy || undefined } }, true)}
            />
          )}
        </div>
      )}
    </div>
  );
}
