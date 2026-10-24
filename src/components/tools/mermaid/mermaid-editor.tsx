"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert, Download, ImageDown, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { ToolShell } from "@/components/shared/tool-shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounced } from "@/hooks/use-debounced";
import { useShareHash } from "@/hooks/use-share-hash";
import { useToolInput } from "@/hooks/use-tool-input";
import { useMermaid } from "@/hooks/use-mermaid";
import { downloadBlob } from "@/lib/download";
import { svgToPng } from "@/lib/svg-export";
import { mermaidTemplates, type MermaidTemplate } from "./templates";

const isShared = (v: unknown): v is { code: string } =>
  typeof v === "object" && v !== null && typeof (v as { code?: unknown }).code === "string";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export default function MermaidEditor() {
  const t = useTranslations("tools.mermaid");
  const tc = useTranslations("common");
  const share = useShareHash("mermaid", isShared);
  const [code, setCode] = useToolInput("mermaid", mermaidTemplates.flowchart, {
    initial: () => share.readInitial()?.code ?? null,
  });
  const debounced = useDebounced(code, 300);
  const { svg, error } = useMermaid(debounced);
  const [zoom, setZoom] = useState(1);

  // Ctrl/Cmd + wheel zooms. Native listener: React's wheel handlers are passive.
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * (e.deltaY < 0 ? 1.1 : 0.9))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <ToolShell
      toolId="mermaid"
      inputLabel="diagram.mmd"
      outputLabel={t("preview")}
      defaultInputSize={40}
      onExample={() => setCode(mermaidTemplates.flowchart)}
      onClear={() => setCode("")}
      copyText={code}
      onShare={() => share.createLink({ code })}
      toolbar={
        <Select onValueChange={(v) => setCode(mermaidTemplates[v as MermaidTemplate])}>
          <SelectTrigger size="sm" className="h-7 w-auto gap-1 text-xs" aria-label={t("templates")}>
            <SelectValue placeholder={t("templates")} />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(mermaidTemplates) as MermaidTemplate[]).map((k) => (
              <SelectItem key={k} value={k}>
                {t(`template.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      outputActions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("zoomOut")}
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.25))}
          >
            <ZoomOut />
          </Button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="w-12 text-center font-mono text-xs text-muted-foreground tabular-nums hover:text-foreground"
            aria-label={`${t("zoomReset")} ${Math.round(zoom * 100)}%`}
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("zoomIn")}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))}
          >
            <ZoomIn />
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={t("fit")} onClick={() => setZoom(1)}>
            <Maximize />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={!svg}
            onClick={() => downloadBlob(new Blob([svg], { type: "image/svg+xml" }), "diagram.svg")}
          >
            <Download />
            SVG
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={!svg}
            onClick={async () => downloadBlob(await svgToPng(svg), "diagram.png")}
          >
            <ImageDown />
            PNG
          </Button>
        </>
      }
      input={<CodeEditor value={code} onChange={setCode} ariaLabel={t("code")} placeholder={t("placeholder")} />}
      output={
        <div ref={previewRef} className="relative flex h-full min-h-0 flex-col">
          {error && (
            <div
              role="alert"
              className="flex shrink-0 items-start gap-2 border-b bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <pre className="font-mono whitespace-pre-wrap">{error}</pre>
            </div>
          )}
          {!svg && !error ? (
            <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-4" data-testid="mermaid-preview">
              <div
                className="origin-top-left transition-transform [&_svg]:h-auto [&_svg]:max-w-none"
                style={{ transform: `scale(${zoom})`, opacity: error ? 0.4 : 1 }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          )}
        </div>
      }
    />
  );
}
