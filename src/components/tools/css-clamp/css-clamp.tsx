"use client";

import { useCallback, useMemo, useState } from "react";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useShareHash } from "@/hooks/use-share-hash";
import { buildClamp, evaluateClamp, type ClampInput } from "@/lib/utils/css/clamp";

interface ClampState extends ClampInput {
  property: string;
}

const DEFAULTS: ClampState = {
  property: "font-size",
  minSize: 16,
  maxSize: 24,
  minViewport: 360,
  maxViewport: 1280,
  rootFontSize: 16,
};

const EXAMPLE: ClampState = { ...DEFAULTS, minSize: 32, maxSize: 64 };

const numericKeys = ["minSize", "maxSize", "minViewport", "maxViewport", "rootFontSize"] as const;

function isClampState(v: unknown): v is ClampState {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.property === "string" && numericKeys.every((k) => typeof o[k] === "number");
}

function NumberField({
  id,
  label,
  value,
  onChange,
  suffix = "px",
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
          className="pe-10 font-mono"
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center font-mono text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}

export default function CssClamp() {
  const t = useTranslations("tools.css-clamp");
  const tc = useTranslations("common");
  const share = useShareHash("css-clamp", isClampState);
  const [state, setState] = useState<ClampState>(() => share.readInitial() ?? DEFAULTS);
  const [viewport, setViewport] = useState(() => Math.round((state.minViewport + state.maxViewport) / 2));

  const set = useCallback(<K extends keyof ClampState>(key: K, value: ClampState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const result = useMemo(() => buildClamp(state), [state]);
  const declaration = result.ok ? `${state.property || "font-size"}: ${result.result.css};` : "";
  const tailwind = result.ok ? `[${state.property || "font-size"}:${result.result.css.replace(/\s+/g, "_")}]` : "";
  const sliderMin = Math.max(240, Math.min(state.minViewport, 2560) - 160);
  const sliderMax = Math.max(sliderMin + 100, Math.min(state.maxViewport, 2560) + 320);
  const previewPx = result.ok ? evaluateClamp(result.result, viewport, state.rootFontSize) : 0;

  return (
    <ToolShell
      toolId="css-clamp"
      inputLabel={t("settings")}
      outputLabel={t("result")}
      defaultInputSize={38}
      onExample={() => setState(EXAMPLE)}
      onClear={() => setState(DEFAULTS)}
      copyText={declaration}
      onShare={() => share.createLink(state)}
      input={
        <form className="grid gap-4 p-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="clamp-property" className="text-xs text-muted-foreground">
              {t("property")}
            </Label>
            <Input
              id="clamp-property"
              value={state.property}
              onChange={(e) => set("property", e.target.value)}
              className="font-mono"
              spellCheck={false}
            />
          </div>
          <NumberField id="clamp-min" label={t("minSize")} value={state.minSize} onChange={(n) => set("minSize", n)} />
          <NumberField id="clamp-max" label={t("maxSize")} value={state.maxSize} onChange={(n) => set("maxSize", n)} />
          <NumberField
            id="clamp-min-vw"
            label={t("minViewport")}
            value={state.minViewport}
            onChange={(n) => set("minViewport", n)}
          />
          <NumberField
            id="clamp-max-vw"
            label={t("maxViewport")}
            value={state.maxViewport}
            onChange={(n) => set("maxViewport", n)}
          />
          <NumberField
            id="clamp-root"
            label={t("rootFontSize")}
            value={state.rootFontSize}
            onChange={(n) => set("rootFontSize", n)}
          />
          <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">{t("why")}</p>
        </form>
      }
      output={
        !result.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t(`errors.${result.error}`)}
          </p>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="space-y-3 border-b p-4">
              <div className="flex items-start gap-2">
                <code
                  data-testid="clamp-output"
                  className="block flex-1 overflow-x-auto rounded-md bg-editor p-3 font-mono text-[13px] text-foreground"
                >
                  <span className="text-[var(--syntax-key)]">{state.property || "font-size"}</span>
                  {": "}
                  <span className="text-[var(--syntax-string)]">{result.result.css}</span>;
                </code>
                <CopyButton text={declaration} size="icon-sm" />
              </div>
              <div className="flex items-start gap-2">
                <code className="block flex-1 overflow-x-auto rounded-md bg-editor p-3 font-mono text-xs text-muted-foreground">
                  {tailwind}
                </code>
                <CopyButton text={tailwind} size="icon-sm" label={t("copyTailwind")} />
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="clamp-viewport" className="shrink-0 text-xs text-muted-foreground">
                  {t("viewport")}
                </Label>
                <Slider
                  id="clamp-viewport"
                  min={sliderMin}
                  max={sliderMax}
                  step={1}
                  value={[Math.min(Math.max(viewport, sliderMin), sliderMax)]}
                  onValueChange={([v]) => setViewport(v)}
                  aria-label={t("viewport")}
                />
                <output className="w-36 shrink-0 text-end font-mono text-xs tabular-nums">
                  {viewport}px → {previewPx.toFixed(2)}px
                </output>
              </div>
              <div
                className="min-h-0 flex-1 overflow-hidden rounded-md border border-dashed bg-editor p-4"
                aria-label={t("preview")}
              >
                <p className="leading-tight font-semibold text-foreground" style={{ fontSize: `${previewPx}px` }}>
                  {t("sample")}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{tc("shareHint")}</p>
            </div>
          </div>
        )
      }
    />
  );
}
