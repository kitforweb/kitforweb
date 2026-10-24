"use client";

import { useRef, useState, type PointerEvent } from "react";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { CopyButton } from "@/components/shared/copy-button";
import { NumberField } from "@/components/shared/number-field";
import { ToolShell } from "@/components/shared/tool-shell";
import { ToolbarSelect } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { useShareHash } from "@/hooks/use-share-hash";
import { initialToolInput, usePersistInput } from "@/hooks/use-tool-input";
import { bezierToCss, curvePath, parseBezier, PRESETS, type Bezier } from "@/lib/utils/css/bezier";

const isShare = (v: unknown): v is { css: string } =>
  typeof v === "object" && v !== null && typeof (v as { css?: unknown }).css === "string";

// The box leaves room above and below for curves that overshoot (back easings).
const SIZE = 200;
const PAD = 60;
const VIEW = SIZE + PAD * 2;

function initial(text: string): Bezier {
  const r = parseBezier(text);
  return r.ok ? r.bezier : [...PRESETS.ease];
}

export default function CubicBezier() {
  const t = useTranslations("tools.cubic-bezier");
  const tc = useTranslations("common");
  const share = useShareHash("cubic-bezier", isShare);
  const [b, setB] = useState<Bezier>(() =>
    initial(initialToolInput("cubic-bezier", "", { initial: () => share.readInitial()?.css ?? null })),
  );
  const [duration, setDuration] = useState(800);
  const [run, setRun] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<0 | 1 | null>(null);
  const css = bezierToCss(b);
  usePersistInput("cubic-bezier", css);
  const preset = Object.entries(PRESETS).find(([, p]) => p.every((v, i) => v === b[i]))?.[0] ?? "custom";

  const toPoint = (e: PointerEvent): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = VIEW / rect.width;
    const x = ((e.clientX - rect.left) * scale - PAD) / SIZE;
    const y = 1 - ((e.clientY - rect.top) * scale - PAD) / SIZE;
    const r = (n: number) => Math.round(n * 100) / 100;
    return [r(Math.min(1, Math.max(0, x))), r(Math.min(1.5, Math.max(-0.5, y)))];
  };

  const onMove = (e: PointerEvent) => {
    if (dragging.current === null) return;
    const [x, y] = toPoint(e);
    setB((cur) => (dragging.current === 0 ? [x, y, cur[2], cur[3]] : [cur[0], cur[1], x, y]));
  };

  const X = (v: number) => PAD + v * SIZE;
  const Y = (v: number) => PAD + (1 - v) * SIZE;
  const setAt = (i: number, v: number) => setB((cur) => cur.map((c, j) => (j === i ? v : c)) as Bezier);

  return (
    <ToolShell
      toolId="cubic-bezier"
      inputLabel={t("curve")}
      outputLabel={t("preview")}
      defaultInputSize={50}
      onExample={() => setB([...PRESETS.easeOutBack])}
      onClear={() => setB([...PRESETS.ease])}
      copyText={css}
      onShare={() => share.createLink({ css })}
      toolbar={
        <ToolbarSelect
          label={t("presets")}
          value={preset}
          onChange={(name) => name !== "custom" && setB([...PRESETS[name]])}
          options={[
            { value: "custom", label: t("custom") },
            ...Object.keys(PRESETS).map((name) => ({ value: name, label: name })),
          ]}
        />
      }
      input={
        <div className="space-y-4 p-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="mx-auto w-full max-w-sm touch-none select-none"
            onPointerMove={onMove}
            onPointerUp={() => (dragging.current = null)}
            onPointerLeave={() => (dragging.current = null)}
            role="img"
            aria-label={css}
            data-testid="bezier-svg"
          >
            <rect x={PAD} y={PAD} width={SIZE} height={SIZE} className="fill-muted/40 stroke-border" />
            <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} className="stroke-border" strokeDasharray="4 4" />
            <line x1={X(0)} y1={Y(0)} x2={X(b[0])} y2={Y(b[1])} className="stroke-muted-foreground" />
            <line x1={X(1)} y1={Y(1)} x2={X(b[2])} y2={Y(b[3])} className="stroke-muted-foreground" />
            <path d={curvePath(b, SIZE, PAD)} className="fill-none stroke-primary" strokeWidth={3} />
            {([0, 1] as const).map((i) => (
              <circle
                key={i}
                cx={X(b[i * 2])}
                cy={Y(b[i * 2 + 1])}
                r={9}
                className={
                  i === 0 ? "cursor-grab fill-[var(--syntax-key)]" : "cursor-grab fill-[var(--syntax-keyword)]"
                }
                onPointerDown={(e) => {
                  dragging.current = i;
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                }}
                data-testid={`bezier-p${i + 1}`}
              />
            ))}
          </svg>
          <div className="grid grid-cols-4 gap-2">
            {(["x1", "y1", "x2", "y2"] as const).map((label, i) => (
              <NumberField key={label} label={label} step={0.01} value={b[i]} onChange={(v) => setAt(i, v)} />
            ))}
          </div>
          {(b[0] < 0 || b[0] > 1 || b[2] < 0 || b[2] > 1) && <p className="text-sm text-destructive">{t("xRange")}</p>}
        </div>
      }
      output={
        <div className="space-y-5 p-4">
          <div className="flex items-start gap-2">
            <pre className="flex-1 overflow-x-auto rounded-md bg-editor p-3 font-mono text-sm" data-testid="bezier-css">
              {`transition-timing-function: ${css};`}
            </pre>
            <CopyButton text={css} size="icon-sm" />
          </div>
          <div className="flex items-end gap-3">
            <NumberField
              label={t("duration")}
              suffix="ms"
              step={100}
              min={100}
              value={duration}
              onChange={setDuration}
              className="w-32"
            />
            <Button type="button" onClick={() => setRun((n) => n + 1)}>
              <Play />
              {t("play")}
            </Button>
          </div>
          {/* Keyed by run: each play remounts the tracks so the animation starts over. */}
          <div key={run} className="space-y-3">
            {[
              { label: css, timing: css, testId: "bezier-track" },
              { label: "linear", timing: "linear", testId: undefined },
            ].map(({ label, timing, testId }) => (
              <div key={label} className="space-y-1">
                <p className="font-mono text-xs text-muted-foreground">{label}</p>
                <div className="relative h-10 rounded-md bg-muted">
                  <div
                    className="absolute top-1 left-1 size-8 rounded-md bg-primary"
                    data-testid={testId}
                    style={
                      run > 0
                        ? {
                            animation: `bezier-slide ${Number.isFinite(duration) ? duration : 800}ms ${timing} forwards`,
                          }
                        : undefined
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <style>{"@keyframes bezier-slide { to { left: calc(100% - 2.25rem); } }"}</style>
          <p className="text-xs text-muted-foreground">{tc("shareHint")}</p>
        </div>
      }
    />
  );
}
