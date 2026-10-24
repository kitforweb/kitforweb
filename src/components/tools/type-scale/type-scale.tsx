"use client";

import { useMemo, useState } from "react";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { NumberField } from "@/components/shared/number-field";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarSelect } from "@/components/shared/toolbar-controls";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useShareHash } from "@/hooks/use-share-hash";
import { evaluateClamp, buildClamp } from "@/lib/utils/css/clamp";
import {
  exportTypeScale,
  RATIOS,
  typeScale,
  type TypeScaleFormat,
  type TypeScaleInput,
} from "@/lib/utils/css/type-scale";

const DEFAULTS: TypeScaleInput = {
  minBase: 16,
  maxBase: 18,
  minRatio: 1.2,
  maxRatio: 1.25,
  minViewport: 360,
  maxViewport: 1280,
  rootFontSize: 16,
  stepsDown: 2,
  stepsUp: 5,
};

const EXAMPLE: TypeScaleInput = { ...DEFAULTS, maxBase: 20, maxRatio: 1.333 };

const KEYS = Object.keys(DEFAULTS) as (keyof TypeScaleInput)[];
const isInput = (v: unknown): v is TypeScaleInput =>
  typeof v === "object" && v !== null && KEYS.every((k) => typeof (v as Record<string, unknown>)[k] === "number");

const ratioOptions = RATIOS.map((r) => ({ value: String(r.value), label: `${r.value} · ${r.name}` }));

export default function TypeScale() {
  const t = useTranslations("tools.type-scale");
  const tc = useTranslations("common");
  const share = useShareHash("type-scale", isInput);
  const [input, setInput] = useState<TypeScaleInput>(() => share.readInitial() ?? DEFAULTS);
  const [format, setFormat] = useState<TypeScaleFormat>("css");
  const [viewport, setViewport] = useState(1024);
  const set = <K extends keyof TypeScaleInput>(k: K, v: TypeScaleInput[K]) => setInput((s) => ({ ...s, [k]: v }));

  const result = useMemo(() => typeScale(input), [input]);
  const code = result.ok ? exportTypeScale(result.steps, format) : "";
  const ratioValue = (r: number) => (RATIOS.some((x) => x.value === r) ? String(r) : String(RATIOS[2].value));

  return (
    <ToolShell
      toolId="type-scale"
      inputLabel={t("settings")}
      outputLabel={t("scale")}
      defaultInputSize={36}
      onExample={() => setInput(EXAMPLE)}
      onClear={() => setInput(DEFAULTS)}
      copyText={code}
      onShare={() => share.createLink(input)}
      toolbar={
        <Segmented
          label={t("format")}
          value={format}
          onChange={setFormat}
          options={[
            { value: "css", label: "CSS" },
            { value: "tailwind4", label: "Tailwind v4" },
            { value: "tailwind3", label: "Tailwind v3" },
          ]}
        />
      }
      input={
        <div className="grid grid-cols-2 gap-3 p-4">
          <p className="col-span-2 text-xs font-semibold text-muted-foreground">
            {t("small", { vw: input.minViewport })}
          </p>
          <NumberField label={t("base")} suffix="px" value={input.minBase} onChange={(v) => set("minBase", v)} />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("ratio")}</Label>
            <ToolbarSelect
              label={t("ratio")}
              value={ratioValue(input.minRatio)}
              onChange={(v) => set("minRatio", Number(v))}
              options={ratioOptions}
            />
          </div>
          <p className="col-span-2 pt-2 text-xs font-semibold text-muted-foreground">
            {t("large", { vw: input.maxViewport })}
          </p>
          <NumberField label={t("base")} suffix="px" value={input.maxBase} onChange={(v) => set("maxBase", v)} />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("ratio")}</Label>
            <ToolbarSelect
              label={`${t("ratio")} (max)`}
              value={ratioValue(input.maxRatio)}
              onChange={(v) => set("maxRatio", Number(v))}
              options={ratioOptions}
            />
          </div>
          <NumberField
            label={t("minViewport")}
            suffix="px"
            value={input.minViewport}
            onChange={(v) => set("minViewport", v)}
          />
          <NumberField
            label={t("maxViewport")}
            suffix="px"
            value={input.maxViewport}
            onChange={(v) => set("maxViewport", v)}
          />
          <NumberField
            label={t("stepsUp")}
            value={input.stepsUp}
            min={0}
            max={10}
            onChange={(v) => set("stepsUp", v)}
          />
          <NumberField
            label={t("stepsDown")}
            value={input.stepsDown}
            min={0}
            max={4}
            onChange={(v) => set("stepsDown", v)}
          />
          <NumberField
            label={t("root")}
            suffix="px"
            value={input.rootFontSize}
            onChange={(v) => set("rootFontSize", v)}
          />
        </div>
      }
      output={
        !result.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t(`errors.${result.error}`)}
          </p>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center gap-4 border-b px-4 py-3">
              <Label className="shrink-0 text-xs text-muted-foreground">{t("viewport")}</Label>
              <Slider
                min={320}
                max={1920}
                step={1}
                value={[viewport]}
                onValueChange={([v]) => setViewport(v)}
                aria-label={t("viewport")}
              />
              <output className="w-16 shrink-0 text-end font-mono text-xs">{viewport}px</output>
            </div>
            <ol className="min-h-0 flex-1 divide-y overflow-auto" data-testid="type-steps">
              {result.steps.map((s) => {
                const c = buildClamp({ ...input, minSize: s.minPx, maxSize: s.maxPx });
                const px = c.ok ? evaluateClamp(c.result, viewport, input.rootFontSize) : s.minPx;
                return (
                  <li key={s.index} className="flex items-baseline gap-4 px-4 py-2" data-step={s.name}>
                    <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                      {s.name}
                      <span className="block">
                        {s.minPx}–{s.maxPx}px
                      </span>
                    </span>
                    <span className="truncate leading-tight font-semibold" style={{ fontSize: `${px}px` }}>
                      {t("sample")}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="h-56 shrink-0 border-t" data-testid="type-code">
              <CodeEditor
                value={code}
                readOnly
                language={format === "tailwind3" ? "javascript" : "css"}
                ariaLabel={t("scale")}
              />
            </div>
            <p className="border-t px-4 py-2 text-xs text-muted-foreground">{tc("shareHint")}</p>
          </div>
        )
      }
    />
  );
}
