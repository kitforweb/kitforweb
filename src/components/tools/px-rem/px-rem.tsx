"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { NumberField } from "@/components/shared/number-field";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { convertCss, convertUnit, referenceTable, type CssUnit } from "@/lib/utils/css/units";

const EXAMPLE = `.card {
  padding: 24px 32px;
  margin-bottom: 48px;
  font-size: 18px;
  line-height: 28px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}`;

const UNITS: CssUnit[] = ["px", "rem", "em"];

export default function PxRem() {
  const t = useTranslations("tools.px-rem");
  const [text, setText] = useToolInput("px-rem", "");
  const [base, setBase] = useState(16);
  const [from, setFrom] = useState<CssUnit>("px");
  const [to, setTo] = useState<CssUnit>("rem");
  const [hairlines, setHairlines] = useState(true);
  const debounced = useDebounced(text, 150);
  const validBase = Number.isFinite(base) && base > 0 ? base : 16;

  const batch = useMemo(
    () => (debounced.trim() ? convertCss(debounced, from, to, { base: validBase, keepHairlines: hairlines }) : null),
    [debounced, from, to, validBase, hairlines],
  );
  // A single value ("24" or "24px") is shown in every unit, as a quick converter.
  const singleMatch = /^\s*(-?\d*\.?\d+)\s*(px|rem|em)?\s*$/.exec(debounced);
  const single = singleMatch ? Number(singleMatch[1]) : null;
  const singleUnit = (singleMatch?.[2] as CssUnit | undefined) ?? from;

  return (
    <ToolShell
      toolId="px-rem"
      inputLabel={t("input")}
      outputLabel={t("output")}
      onExample={() => setText(EXAMPLE)}
      onClear={() => setText("")}
      onSwap={() => {
        setFrom(to);
        setTo(from);
      }}
      copyText={batch?.output ?? ""}
      toolbar={
        <>
          <Segmented
            label={t("from")}
            value={from}
            onChange={setFrom}
            options={UNITS.map((u) => ({ value: u, label: u }))}
          />
          <span className="px-1 text-xs text-muted-foreground">→</span>
          <Segmented label={t("to")} value={to} onChange={setTo} options={UNITS.map((u) => ({ value: u, label: u }))} />
          <ToolbarSwitch label={t("hairlines")} checked={hairlines} onChange={setHairlines} />
        </>
      }
      input={
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-end gap-3 border-b p-3">
            <NumberField label={t("base")} suffix="px" value={base} onChange={setBase} className="w-32" />
            <p className="pb-2 text-xs text-muted-foreground">{t("baseHint")}</p>
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor
              value={text}
              onChange={setText}
              language="css"
              ariaLabel={t("input")}
              placeholder={t("placeholder")}
            />
          </div>
        </div>
      }
      output={
        <div className="flex h-full min-h-0 flex-col">
          {single !== null ? (
            <dl className="grid grid-cols-3 gap-3 p-4" data-testid="pxrem-single">
              {UNITS.map((u) => {
                const v = `${convertUnit(single, singleUnit, u, validBase)}${u}`;
                return (
                  <div key={u} className="rounded-md border p-3">
                    <dt className="text-xs text-muted-foreground">{u}</dt>
                    <dd className="flex items-center gap-1 font-mono text-xl">
                      {v}
                      <CopyButton text={v} size="icon-sm" />
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : batch ? (
            <>
              <p role="status" className="shrink-0 border-b px-3 py-1.5 font-mono text-xs text-muted-foreground">
                {t("converted", { count: batch.count })}
              </p>
              <div className="min-h-0 flex-1" data-testid="converter-output">
                <CodeEditor value={batch.output} readOnly language="css" ariaLabel={t("output")} />
              </div>
            </>
          ) : null}
          <section className="shrink-0 overflow-auto border-t p-3">
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{t("table", { base: validBase })}</h3>
            <ul className="grid grid-cols-4 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-5">
              {referenceTable(validBase).map((r) => (
                <li key={r.px} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{r.px}px</span>
                  <span>{r.rem}rem</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      }
    />
  );
}
