"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ColorField } from "@/components/shared/color-field";
import { CopyButton } from "@/components/shared/copy-button";
import { NumberField } from "@/components/shared/number-field";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useShareHash } from "@/hooks/use-share-hash";
import { initialToolInput, usePersistInput } from "@/hooks/use-tool-input";
import {
  DEFAULT_GRADIENT,
  gradientToCss,
  parseGradient,
  type Gradient,
  type GradientType,
} from "@/lib/utils/css/gradient";

const isShare = (v: unknown): v is { css: string } =>
  typeof v === "object" && v !== null && typeof (v as { css?: unknown }).css === "string";

const EXAMPLE = "linear-gradient(135deg, #0ea5e9 0%, #6366f1 45%, #d946ef 100%)";

export default function GradientTool() {
  const t = useTranslations("tools.gradient");
  const tc = useTranslations("common");
  const share = useShareHash("gradient", isShare);
  const [g, setG] = useState<Gradient>(
    () =>
      parseGradient(initialToolInput("gradient", "", { initial: () => share.readInitial()?.css ?? null })) ??
      DEFAULT_GRADIENT,
  );
  const [paste, setPaste] = useState("");
  const css = gradientToCss(g);
  usePersistInput("gradient", css);
  const declaration = `background: ${css};`;
  const set = (patch: Partial<Gradient>) => setG((cur) => ({ ...cur, ...patch }));
  const setStop = (i: number, patch: Partial<Gradient["stops"][number]>) =>
    setG((cur) => ({ ...cur, stops: cur.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const pasted = paste.trim() ? parseGradient(paste) : null;

  return (
    <ToolShell
      toolId="gradient"
      inputLabel={t("settings")}
      outputLabel={t("preview")}
      defaultInputSize={45}
      onExample={() => setG(parseGradient(EXAMPLE)!)}
      onClear={() => setG(DEFAULT_GRADIENT)}
      copyText={declaration}
      onShare={() => share.createLink({ css })}
      toolbar={
        <>
          <Segmented
            label={t("type")}
            value={g.type}
            onChange={(type: GradientType) => set({ type })}
            options={[
              { value: "linear", label: t("linear") },
              { value: "radial", label: t("radial") },
              { value: "conic", label: t("conic") },
            ]}
          />
          <ToolbarSwitch label={t("repeating")} checked={g.repeating} onChange={(repeating) => set({ repeating })} />
        </>
      }
      input={
        <div className="space-y-4 p-4">
          {g.type !== "radial" && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("angle")}</span>
                <span className="font-mono">{g.angle}°</span>
              </div>
              <Slider
                min={0}
                max={360}
                step={1}
                value={[g.angle]}
                onValueChange={([angle]) => set({ angle })}
                aria-label={t("angle")}
              />
            </div>
          )}
          {g.type === "radial" && (
            <Segmented
              label={t("shape")}
              value={g.shape}
              onChange={(shape: Gradient["shape"]) => set({ shape })}
              options={[
                { value: "circle", label: t("circle") },
                { value: "ellipse", label: t("ellipse") },
              ]}
            />
          )}
          {g.type !== "linear" && (
            <div className="grid grid-cols-2 gap-2">
              <NumberField label={t("centerX")} suffix="%" value={g.x} onChange={(x) => set({ x })} />
              <NumberField label={t("centerY")} suffix="%" value={g.y} onChange={(y) => set({ y })} />
            </div>
          )}
          <ol className="space-y-3" data-testid="gradient-stops">
            {g.stops.map((s, i) => (
              <li key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-end gap-2">
                  <ColorField
                    label={t("stop", { n: i + 1 })}
                    value={s.color}
                    onChange={(color) => setStop(i, { color })}
                    className="flex-1"
                  />
                  <NumberField
                    label={t("position")}
                    suffix="%"
                    value={s.position}
                    min={0}
                    max={100}
                    onChange={(position) => setStop(i, { position })}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("remove")}
                    disabled={g.stops.length <= 2}
                    onClick={() => set({ stops: g.stops.filter((_, j) => j !== i) })}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[Number.isFinite(s.position) ? s.position : 0]}
                  onValueChange={([position]) => setStop(i, { position })}
                  aria-label={`${t("position")} ${i + 1}`}
                />
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              set({ stops: [...g.stops, { color: g.stops[g.stops.length - 1]?.color ?? "#ffffff", position: 100 }] })
            }
          >
            <Plus />
            {t("add")}
          </Button>
          <div className="space-y-1 border-t pt-4">
            <label htmlFor="gradient-paste" className="text-xs text-muted-foreground">
              {t("paste")}
            </label>
            <div className="flex gap-2">
              <Input
                id="gradient-paste"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="linear-gradient(to right, red, blue)"
                className="font-mono"
                spellCheck={false}
              />
              <Button type="button" variant="secondary" disabled={!pasted} onClick={() => pasted && setG(pasted)}>
                {t("load")}
              </Button>
            </div>
          </div>
        </div>
      }
      output={
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-56 flex-1" style={{ background: css }} data-testid="gradient-preview" />
          <div className="space-y-3 border-t p-4">
            <div className="flex items-start gap-2">
              <pre
                className="flex-1 overflow-x-auto rounded-md bg-editor p-3 font-mono text-xs whitespace-pre-wrap"
                data-testid="gradient-css"
              >
                {declaration}
              </pre>
              <CopyButton text={declaration} size="icon-sm" />
            </div>
            <p className="text-xs text-muted-foreground">{tc("shareHint")}</p>
          </div>
        </div>
      }
    />
  );
}
