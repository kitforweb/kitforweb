"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Download, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ImageDrop } from "@/components/shared/image-drop";
import { NumberField } from "@/components/shared/number-field";
import { ToolShell } from "@/components/shared/tool-shell";
import { Segmented } from "@/components/shared/toolbar-controls";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { downloadBlob } from "@/lib/download";
import { brandExamples, exampleFile } from "@/lib/examples";
import { canEncode, canvasToBlob, createCanvas, loadImage } from "@/lib/image-canvas";
import { formatBytes } from "@/lib/utils/format/bytes";
import { MIME, outputName, savings, scaledSize, type ImageFormat } from "@/lib/utils/image/convert";

interface Output {
  key: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

export default function WebpConverter() {
  const t = useTranslations("tools.webp");
  const locale = useLocale();
  const [source, setSource] = useState<{ file: File; url: string } | null>(null);
  const file = source?.file ?? null;
  const sourceUrl = source?.url ?? null;
  const setFile = (f: File | null) =>
    setSource((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return f ? { file: f, url: URL.createObjectURL(f) } : null;
    });
  const [format, setFormat] = useState<ImageFormat>("webp");
  const [quality, setQuality] = useState(80);
  const [maxWidth, setMaxWidth] = useState(0);
  const [avif, setAvif] = useState(false);
  const [out, setOut] = useState<Output | { key: string; error: true } | null>(null);
  const key = file ? `${file.name}:${file.size}:${format}:${quality}:${maxWidth}` : "";

  useEffect(() => {
    void canEncode("image/avif").then(setAvif);
  }, []);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let made: string | null = null;
    // Small debounce so dragging the quality slider does not encode on every step.
    const id = window.setTimeout(async () => {
      try {
        const img = await loadImage(file);
        const size = scaledSize(img.width, img.height, Number.isFinite(maxWidth) ? maxWidth : 0);
        const [canvas, ctx] = createCanvas(size.width, size.height);
        if (format === "jpeg") {
          // JPEG has no transparency: flatten on white instead of black.
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, size.width, size.height);
        }
        ctx.drawImage(img.source, 0, 0, size.width, size.height);
        img.dispose();
        const blob = await canvasToBlob(canvas, MIME[format], quality / 100);
        made = URL.createObjectURL(blob);
        if (!cancelled) setOut({ key, blob, url: made, ...size });
      } catch {
        if (!cancelled) setOut({ key, error: true });
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
      if (made) URL.revokeObjectURL(made);
    };
  }, [file, format, quality, maxWidth, key]);

  const current = out && out.key === key ? out : null;
  const lossless = format === "png";

  return (
    <ToolShell
      toolId="webp"
      inputLabel={t("original")}
      outputLabel={t("converted")}
      onExample={async () => setFile(await exampleFile(brandExamples.banner))}
      onClear={() => setFile(null)}
      outputActions={
        current &&
        "blob" in current && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => downloadBlob(current.blob, outputName(file!.name, format))}
          >
            <Download />
            {format.toUpperCase()}
          </Button>
        )
      }
      toolbar={
        <>
          <Segmented
            label={t("format")}
            value={format}
            onChange={setFormat}
            options={[
              { value: "webp", label: "WebP" },
              ...(avif ? [{ value: "avif" as const, label: "AVIF" }] : []),
              { value: "jpeg", label: "JPEG" },
              { value: "png", label: "PNG" },
            ]}
          />
        </>
      }
      input={
        <div className="space-y-4 p-4">
          <ImageDrop onFile={([f]) => setFile(f)} label={t("choose")} hint={t("chooseHint")} />
          {file && sourceUrl && (
            <figure className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sourceUrl} alt={file.name} className="max-h-64 w-full rounded-md border object-contain" />
              <figcaption className="font-mono text-xs text-muted-foreground" data-testid="webp-original">
                {file.name} · {formatBytes(file.size, locale)}
              </figcaption>
            </figure>
          )}
          {!lossless && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("quality")}</span>
                <span className="font-mono">{quality}</span>
              </div>
              <Slider
                min={1}
                max={100}
                step={1}
                value={[quality]}
                onValueChange={([v]) => setQuality(v)}
                aria-label={t("quality")}
              />
            </div>
          )}
          <NumberField
            label={t("maxWidth")}
            suffix="px"
            min={0}
            value={maxWidth}
            onChange={setMaxWidth}
            className="w-40"
          />
          {!avif && <p className="text-xs text-muted-foreground">{t("noAvif")}</p>}
        </div>
      }
      output={
        !file ? (
          <p className="p-4 text-sm text-muted-foreground">{t("hint")}</p>
        ) : !current ? (
          <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            {t("encoding")}
          </p>
        ) : "error" in current ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t("unreadable")}
          </p>
        ) : (
          <div className="space-y-3 p-4">
            <p role="status" className="font-mono text-sm" data-testid="webp-result">
              {format.toUpperCase()} · {current.width}×{current.height} · {formatBytes(current.blob.size, locale)}{" "}
              <span className={savings(file.size, current.blob.size) > 0 ? "text-success" : "text-destructive"}>
                {t("saved", { percent: savings(file.size, current.blob.size) })}
              </span>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={t("converted")}
              className="max-h-[60vh] w-full rounded-md border object-contain"
            />
          </div>
        )
      }
    />
  );
}
