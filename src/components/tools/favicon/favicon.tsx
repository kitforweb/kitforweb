"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Download, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { ColorField } from "@/components/shared/color-field";
import { CopyButton } from "@/components/shared/copy-button";
import { ImageDrop } from "@/components/shared/image-drop";
import { ToolShell } from "@/components/shared/tool-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { downloadBlob } from "@/lib/download";
import { canvasToBlob, createCanvas, loadImage, type LoadedImage } from "@/lib/image-canvas";
import { buildIco, fitRect, ICO_SIZES, ICON_SPECS, linkTags, webManifest } from "@/lib/utils/image/favicon";

const EXAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#4f46e5"/><path d="M18 20h10l6 12 6-12h6L36 44h-6z" fill="#fff"/></svg>`;

interface Generated {
  icons: { file: string; size: number; blob: Blob; url: string }[];
  ico: Blob;
  svg: string | null;
}

async function render(img: LoadedImage, padding: number, background: string): Promise<Generated> {
  const icons: Generated["icons"] = [];
  for (const spec of ICON_SPECS) {
    const [canvas, ctx] = createCanvas(spec.size, spec.size);
    if (spec.opaque) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, spec.size, spec.size);
    }
    // Maskable icons may be cropped to a circle: keep the logo within the 80% safe zone.
    const r = fitRect(img.width, img.height, spec.size, spec.maskable ? Math.max(padding, 0.1) : padding);
    ctx.drawImage(img.source, r.x, r.y, r.w, r.h);
    const blob = await canvasToBlob(canvas, "image/png");
    icons.push({ file: spec.file, size: spec.size, blob, url: URL.createObjectURL(blob) });
  }
  const pngs = await Promise.all(
    ICO_SIZES.map(async (size) => ({
      size,
      png: new Uint8Array(await icons.find((i) => i.size === size && i.file.startsWith("favicon"))!.blob.arrayBuffer()),
    })),
  );
  return { icons, ico: new Blob([buildIco(pngs) as BlobPart], { type: "image/x-icon" }), svg: null };
}

export default function Favicon() {
  const t = useTranslations("tools.favicon");
  const [file, setFile] = useState<File | null>(null);
  const [padding, setPadding] = useState(0);
  const [background, setBackground] = useState("#ffffff");
  const [name, setName] = useState("My App");
  const [theme, setTheme] = useState("#4f46e5");
  const [state, setState] = useState<{ file: File | null; result: Generated | null; error: boolean }>({
    file: null,
    result: null,
    error: false,
  });

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let produced: Generated | null = null;
    (async () => {
      try {
        const img = await loadImage(file);
        const result = await render(img, padding / 100, background);
        img.dispose();
        result.svg = file.type === "image/svg+xml" ? await file.text() : null;
        produced = result;
        if (!cancelled) setState({ file, result, error: false });
      } catch {
        if (!cancelled) setState({ file, result: null, error: true });
      }
    })();
    return () => {
      cancelled = true;
      produced?.icons.forEach((i) => URL.revokeObjectURL(i.url));
    };
  }, [file, padding, background]);

  const result = file && state.file === file ? state.result : null;
  const pending = !!file && state.file !== file;
  const tags = linkTags(!!result?.svg, theme);
  const manifest = webManifest({ name, shortName: name.slice(0, 12), themeColor: theme, backgroundColor: background });

  const zip = async () => {
    if (!result) return;
    const { default: JSZip } = await import("jszip");
    const z = new JSZip();
    for (const icon of result.icons) z.file(icon.file, icon.blob);
    z.file("favicon.ico", result.ico);
    if (result.svg) z.file("favicon.svg", result.svg);
    z.file("site.webmanifest", manifest);
    z.file("head.html", tags + "\n");
    downloadBlob(await z.generateAsync({ type: "blob" }), "favicons.zip");
  };

  return (
    <ToolShell
      toolId="favicon"
      inputLabel={t("source")}
      outputLabel={t("icons")}
      defaultInputSize={38}
      onExample={() => setFile(new File([EXAMPLE_SVG], "logo.svg", { type: "image/svg+xml" }))}
      onClear={() => setFile(null)}
      copyText={tags}
      outputActions={
        result && (
          <Button type="button" variant="ghost" size="xs" onClick={zip}>
            <Download />
            ZIP
          </Button>
        )
      }
      input={
        <div className="space-y-4 p-4">
          <ImageDrop
            onFile={([f]) => setFile(f)}
            label={t("choose")}
            hint={t("chooseHint")}
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
          />
          {file && <p className="truncate font-mono text-xs text-muted-foreground">{file.name}</p>}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("padding")}</span>
              <span className="font-mono">{padding}%</span>
            </div>
            <Slider
              min={0}
              max={25}
              step={1}
              value={[padding]}
              onValueChange={([v]) => setPadding(v)}
              aria-label={t("padding")}
            />
          </div>
          <ColorField label={t("background")} value={background} onChange={setBackground} />
          <ColorField label={t("theme")} value={theme} onChange={setTheme} />
          <div className="space-y-1">
            <Label htmlFor="favicon-name" className="text-xs text-muted-foreground">
              {t("name")}
            </Label>
            <Input id="favicon-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
      }
      output={
        !file ? (
          <p className="p-4 text-sm text-muted-foreground">{t("hint")}</p>
        ) : pending ? (
          <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            {t("generating")}
          </p>
        ) : state.error || !result ? (
          <p role="alert" className="flex items-center gap-2 p-4 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden />
            {t("unreadable")}
          </p>
        ) : (
          <div className="space-y-5 overflow-auto p-4">
            <ul className="flex flex-wrap items-end gap-4" data-testid="favicon-icons">
              {result.icons.map((icon) => (
                <li key={icon.file} className="flex flex-col items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={icon.url}
                    alt={icon.file}
                    width={Math.min(icon.size, 96)}
                    height={Math.min(icon.size, 96)}
                    className="rounded border bg-[repeating-conic-gradient(var(--muted)_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]"
                    style={{ imageRendering: icon.size < 64 ? "pixelated" : "auto" }}
                  />
                  <span className="font-mono text-[10px] text-muted-foreground">{icon.file}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              favicon.ico (16, 32, 48){result.svg ? " · favicon.svg" : ""} · site.webmanifest
            </p>
            <section className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground">{t("tags")}</h3>
                <CopyButton text={tags} size="icon-sm" />
              </div>
              <pre
                className="overflow-x-auto rounded-md bg-editor p-3 font-mono text-xs leading-5"
                data-testid="favicon-tags"
              >
                {tags}
              </pre>
            </section>
            <section className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground">site.webmanifest</h3>
                <CopyButton text={manifest} size="icon-sm" />
              </div>
              <pre className="max-h-48 overflow-auto rounded-md bg-editor p-3 font-mono text-xs leading-5">
                {manifest}
              </pre>
            </section>
          </div>
        )
      }
    />
  );
}
