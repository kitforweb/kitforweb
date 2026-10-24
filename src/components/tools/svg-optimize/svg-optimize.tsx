"use client";

import { useMemo, useState } from "react";
import { CircleAlert, Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { FileDrop, FileOpenButton } from "@/components/shared/file-drop";
import { ToolShell } from "@/components/shared/tool-shell";
import { ToolbarSelect, ToolbarSwitch } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { useDebounced } from "@/hooks/use-debounced";
import { useSettled } from "@/hooks/use-settled";
import { useToolInput } from "@/hooks/use-tool-input";
import { downloadBlob } from "@/lib/download";
import { formatBytes } from "@/lib/utils/format/bytes";
import { DEFAULT_SVG_OPTIONS, type SvgOptimizeOptions, type SvgOptimizeResult } from "@/lib/utils/image/svg-optimize";
import { runSvgo } from "@/lib/workers";

const EXAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="64" height="64" viewBox="0 0 64.000000 64.000000" version="1.1" id="svg8" inkscape:version="1.3">
  <title>Rocket</title>
  <metadata id="metadata5">exported by an editor</metadata>
  <defs id="defs2"/>
  <g id="layer1" inkscape:label="Layer 1">
    <g id="g10">
      <path id="body" style="fill:#6366f1;fill-opacity:1;stroke:none" d="M 32.000000,4.000000 C 44.000000,14.000000 46.000000,30.000000 40.000000,44.000000 L 24.000000,44.000000 C 18.000000,30.000000 20.000000,14.000000 32.000000,4.000000 Z"/>
      <circle id="window" cx="32.000000" cy="24.000000" r="5.500000" style="fill:#ffffff"/>
      <path id="flame" style="fill:#f97316" d="M 26.000000,46.000000 L 38.000000,46.000000 L 32.000000,60.000000 Z"/>
    </g>
  </g>
</svg>`;

const dataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export default function SvgOptimize() {
  const t = useTranslations("tools.svg-optimize");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [svg, setSvg] = useToolInput("svg-optimize", "");
  const [options, setOptions] = useState<SvgOptimizeOptions>(DEFAULT_SVG_OPTIONS);
  const debounced = useDebounced(svg, 300);
  const set = <K extends keyof SvgOptimizeOptions>(k: K, v: SvgOptimizeOptions[K]) =>
    setOptions((o) => ({ ...o, [k]: v }));

  const running = useMemo<Promise<SvgOptimizeResult> | null>(
    () =>
      debounced.trim()
        ? runSvgo({ svg: debounced, options }).catch((e: unknown) => ({
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          }))
        : null,
    [debounced, options],
  );
  const { value } = useSettled(running);
  const result = running ? value : undefined;

  return (
    <ToolShell
      toolId="svg-optimize"
      inputLabel="input.svg"
      outputLabel={t("optimized")}
      onExample={() => setSvg(EXAMPLE)}
      onClear={() => setSvg("")}
      copyText={result?.ok ? result.output : ""}
      inputActions={<FileOpenButton accept=".svg,image/svg+xml" onText={setSvg} />}
      outputActions={
        result?.ok && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => downloadBlob(result.output, "optimized.svg", "image/svg+xml")}
          >
            <Download />
            SVG
          </Button>
        )
      }
      toolbar={
        <>
          <ToolbarSelect
            label={t("precision")}
            value={String(options.precision)}
            onChange={(v) => set("precision", Number(v))}
            options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: t("decimals", { n }) }))}
          />
          <ToolbarSwitch label="Multipass" checked={options.multipass} onChange={(v) => set("multipass", v)} />
          <ToolbarSwitch label={t("pretty")} checked={options.pretty} onChange={(v) => set("pretty", v)} />
          <ToolbarSwitch label="viewBox" checked={options.keepViewBox} onChange={(v) => set("keepViewBox", v)} />
          <ToolbarSwitch label="<title>" checked={options.keepTitle} onChange={(v) => set("keepTitle", v)} />
        </>
      }
      input={
        <FileDrop onText={setSvg}>
          <CodeEditor value={svg} onChange={setSvg} language="xml" ariaLabel="SVG" placeholder={t("placeholder")} />
        </FileDrop>
      }
      output={
        !running ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : !result ? null : !result.ok ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {result.error === "not-svg" ? t("notSvg") : result.error}
          </p>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <p role="status" className="shrink-0 border-b px-3 py-1.5 font-mono text-xs" data-testid="svg-savings">
              {formatBytes(result.before, locale)} → {formatBytes(result.after, locale)}{" "}
              <span className={result.saved > 0 ? "text-success" : "text-muted-foreground"}>
                {t("saved", { percent: result.saved })}
              </span>
            </p>
            <div className="grid shrink-0 grid-cols-2 gap-3 border-b p-3">
              {[
                { label: t("before"), src: debounced },
                { label: t("after"), src: result.output },
              ].map(({ label, src }) => (
                <figure key={label} className="space-y-1">
                  <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
                  {/* An <img> never runs scripts embedded in the SVG. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dataUrl(src)}
                    alt={label}
                    className="h-32 w-full rounded-md border bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] object-contain p-2"
                  />
                </figure>
              ))}
            </div>
            <div className="min-h-0 flex-1" data-testid="converter-output">
              <CodeEditor
                value={result.output}
                readOnly
                language="xml"
                lineWrapping={!options.pretty}
                ariaLabel={t("optimized")}
              />
            </div>
          </div>
        )
      }
    />
  );
}
