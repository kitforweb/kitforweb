"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { ToolbarSelect } from "@/components/shared/toolbar-controls";
import { useAppLocale } from "@/hooks/use-app-locale";
import { fail, okWithNotes } from "@/lib/utils/convert/result";
import { formatBytes } from "@/lib/utils/format/bytes";
import { compressText, decompressBase64, type CompressionFormat } from "@/lib/utils/encoding/gzip";

const TEXT_EXAMPLE = JSON.stringify(
  {
    users: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, role: "viewer", active: true, locale: "en-US" })),
    message: "Repeated data compresses very well with gzip.",
  },
  null,
  2,
);

const GZIP_EXAMPLE =
  "H4sIAAAAAAAACqtWKi1OLVKyUkpMSVTSUcosSc0tVrKKNtQx0jGO1VHKTS0uTkxPVbJS8kjNyclXSCvKz1VIVEivyiwoSE1RcAzwVChIrMzJT0xRqgUAbSsFr0sAAAA=";

type FormatOption = CompressionFormat | "auto";

export default function Gzip() {
  const t = useTranslations("tools.gzip");
  const locale = useAppLocale();
  const [format, setFormat] = useState<FormatOption>("gzip");

  const convert = useCallback(
    async (input: string, direction: number) => {
      if (direction === 0) {
        const r = await compressText(input, format === "auto" ? "gzip" : format);
        const ratio = r.inputBytes ? Math.round((1 - r.outputBytes / r.inputBytes) * 100) : 0;
        return okWithNotes(r.base64, [
          `${formatBytes(r.inputBytes, locale)} → ${formatBytes(r.outputBytes, locale)}`,
          t("saved", { percent: ratio }),
        ]);
      }
      const r = await decompressBase64(input, format);
      if (!r.ok) return fail(t(`errors.${r.error}`));
      return okWithNotes(r.text, [
        r.format,
        `${formatBytes(r.inputBytes, locale)} → ${formatBytes(r.outputBytes, locale)}`,
      ]);
    },
    [format, locale, t],
  );

  return (
    <ConverterTool
      toolId="gzip"
      directions={[
        { input: { label: t("text") }, output: { label: "Base64" } },
        { input: { label: "Base64" }, output: { label: t("text") } },
      ]}
      convert={convert}
      example={(d) => (d === 0 ? TEXT_EXAMPLE : GZIP_EXAMPLE)}
      placeholder={t("placeholder")}
      wrapOutput
      toolbar={(d) => (
        <>
          <span className="px-1 font-mono text-xs text-accent-text">{d === 0 ? t("compress") : t("decompress")}</span>
          <ToolbarSelect
            label={t("format")}
            value={d === 0 && format === "auto" ? "gzip" : format}
            onChange={setFormat}
            options={[
              ...(d === 1 ? [{ value: "auto" as const, label: t("auto") }] : []),
              { value: "gzip" as const, label: "gzip" },
              { value: "deflate" as const, label: "deflate (zlib)" },
              { value: "deflate-raw" as const, label: "deflate-raw" },
            ]}
          />
        </>
      )}
    />
  );
}
