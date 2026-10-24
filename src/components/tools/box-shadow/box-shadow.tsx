"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ColorField } from "@/components/shared/color-field";
import { CopyButton } from "@/components/shared/copy-button";
import { NumberField } from "@/components/shared/number-field";
import { ToolShell } from "@/components/shared/tool-shell";
import { ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShareHash } from "@/hooks/use-share-hash";
import { initialToolInput, usePersistInput } from "@/hooks/use-tool-input";
import { DEFAULT_LAYER, parseBoxShadow, SHADOW_PRESETS, shadowToCss, type ShadowLayer } from "@/lib/utils/css/shadow";

const isShare = (v: unknown): v is { css: string } =>
  typeof v === "object" && v !== null && typeof (v as { css?: unknown }).css === "string";

const EXAMPLE =
  "0 1px 2px rgb(15 23 42 / 0.08), 0 8px 24px -4px rgb(15 23 42 / 0.18), inset 0 0 0 1px rgb(255 255 255 / 0.6)";

export default function BoxShadow() {
  const t = useTranslations("tools.box-shadow");
  const tc = useTranslations("common");
  const share = useShareHash("box-shadow", isShare);
  const [layers, setLayers] = useState<ShadowLayer[]>(
    () =>
      parseBoxShadow(initialToolInput("box-shadow", "", { initial: () => share.readInitial()?.css ?? null })) ?? [
        DEFAULT_LAYER,
      ],
  );
  const [paste, setPaste] = useState("");
  const [box, setBox] = useState("#ffffff");
  const [canvas, setCanvas] = useState("#e2e8f0");

  const value = shadowToCss(layers);
  const declaration = `box-shadow: ${value};`;
  const tailwind = `shadow-[${value.replace(/\s*,\s*/g, ",").replace(/\s+/g, "_")}]`;
  usePersistInput("box-shadow", value);

  const update = (i: number, patch: Partial<ShadowLayer>) =>
    setLayers((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const pasted = paste.trim() ? parseBoxShadow(paste) : null;

  return (
    <ToolShell
      toolId="box-shadow"
      inputLabel={t("layers")}
      outputLabel={t("preview")}
      defaultInputSize={45}
      onExample={() => setLayers(parseBoxShadow(EXAMPLE)!)}
      onClear={() => setLayers([DEFAULT_LAYER])}
      copyText={declaration}
      onShare={() => share.createLink({ css: value })}
      input={
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(SHADOW_PRESETS).map(([name, css]) => (
              <Button
                key={name}
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setLayers(parseBoxShadow(css)!)}
              >
                {name}
              </Button>
            ))}
          </div>
          <ol className="space-y-3" data-testid="shadow-layers">
            {layers.map((l, i) => (
              <li key={i} className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">{t("layer", { n: i + 1 })}</span>
                  <div className="flex items-center gap-2">
                    <ToolbarSwitch label="inset" checked={l.inset} onChange={(inset) => update(i, { inset })} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("remove")}
                      disabled={layers.length === 1}
                      onClick={() => setLayers((ls) => ls.filter((_, j) => j !== i))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <NumberField label="X" suffix="px" value={l.x} onChange={(x) => update(i, { x })} />
                  <NumberField label="Y" suffix="px" value={l.y} onChange={(y) => update(i, { y })} />
                  <NumberField
                    label={t("blur")}
                    suffix="px"
                    min={0}
                    value={l.blur}
                    onChange={(blur) => update(i, { blur })}
                  />
                  <NumberField
                    label={t("spread")}
                    suffix="px"
                    value={l.spread}
                    onChange={(spread) => update(i, { spread })}
                  />
                </div>
                <ColorField label={t("color")} value={l.color} onChange={(color) => update(i, { color })} />
              </li>
            ))}
          </ol>
          <Button type="button" variant="secondary" size="sm" onClick={() => setLayers((ls) => [...ls, DEFAULT_LAYER])}>
            <Plus />
            {t("add")}
          </Button>
          <div className="space-y-1 border-t pt-4">
            <label htmlFor="shadow-paste" className="text-xs text-muted-foreground">
              {t("paste")}
            </label>
            <div className="flex gap-2">
              <Input
                id="shadow-paste"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder="box-shadow: 0 1px 3px rgb(0 0 0 / .1)"
                className="font-mono"
                spellCheck={false}
              />
              <Button type="button" variant="secondary" disabled={!pasted} onClick={() => pasted && setLayers(pasted)}>
                {t("load")}
              </Button>
            </div>
          </div>
        </div>
      }
      output={
        <div className="flex h-full min-h-0 flex-col">
          <div className="grid min-h-56 flex-1 place-items-center p-8" style={{ background: canvas }}>
            <div
              className="size-40 rounded-xl"
              style={{ background: box, boxShadow: value }}
              data-testid="shadow-preview"
            />
          </div>
          <div className="space-y-3 border-t p-4">
            <div className="flex gap-3">
              <ColorField label={t("box")} value={box} onChange={setBox} className="flex-1" />
              <ColorField label={t("canvas")} value={canvas} onChange={setCanvas} className="flex-1" />
            </div>
            <div className="flex items-start gap-2">
              <pre
                className="flex-1 overflow-x-auto rounded-md bg-editor p-3 font-mono text-xs"
                data-testid="shadow-css"
              >
                {declaration}
              </pre>
              <CopyButton text={declaration} size="icon-sm" />
            </div>
            <div className="flex items-start gap-2">
              <code className="block flex-1 overflow-x-auto rounded-md bg-editor p-3 font-mono text-xs text-muted-foreground">
                {tailwind}
              </code>
              <CopyButton text={tailwind} size="icon-sm" />
            </div>
            <p className="text-xs text-muted-foreground">{tc("shareHint")}</p>
          </div>
        </div>
      }
    />
  );
}
