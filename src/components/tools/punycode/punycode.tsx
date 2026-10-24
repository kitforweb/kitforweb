"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { ConverterTool } from "@/components/shared/converter-tool";
import { ok } from "@/lib/utils/convert/result";
import { convertLines } from "@/lib/utils/encoding/punycode";

const UNICODE_EXAMPLE = `españa.com
münchen.de
info@niño.com
https://bücher.de/katalog?q=straße
例え.テスト`;

const ASCII_EXAMPLE = `xn--espaa-rta.com
xn--mnchen-3ya.de
xn--r8jz45g.xn--zckzah`;

export default function Punycode() {
  const t = useTranslations("tools.punycode");

  const convert = useCallback(
    (input: string, direction: number) => {
      const { output, errors } = convertLines(input, direction === 0);
      return ok(output, errors.length ? [t("lineErrors", { lines: errors.join(", ") })] : undefined);
    },
    [t],
  );

  return (
    <ConverterTool
      toolId="punycode"
      directions={[
        { input: { label: t("unicode") }, output: { label: "ASCII (xn--)" } },
        { input: { label: "ASCII (xn--)" }, output: { label: t("unicode") } },
      ]}
      convert={convert}
      example={(d) => (d === 0 ? UNICODE_EXAMPLE : ASCII_EXAMPLE)}
      placeholder={t("placeholder")}
      toolbar={(d) => (
        <span className="px-1 font-mono text-xs text-accent-text">
          {d === 0 ? "Unicode → ASCII" : "ASCII → Unicode"}
        </span>
      )}
    />
  );
}
