"use client";

import { useMemo } from "react";
import { EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { ToolShell } from "@/components/shared/tool-shell";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { analyzeText, escapeForJs, stripInvisible } from "@/lib/utils/encoding/unicode";
import { utf8Length } from "@/lib/utils/format/bytes";
import { cn } from "cn";

// Contains a zero width space between "pass" and "word".
const EXAMPLE = "Café ☕ 👍🏽 pass\u200Bword ñ";
const MAX_ROWS = 2000;

export default function UnicodeInspector() {
  const t = useTranslations("tools.unicode");
  const tc = useTranslations("common");
  const [input, setInput] = useToolInput("unicode", "");
  const text = useDebounced(input, 150);

  const chars = useMemo(() => analyzeText(text, MAX_ROWS), [text]);
  const stats = useMemo(() => {
    const graphemes =
      typeof Intl.Segmenter === "function" ? [...new Intl.Segmenter().segment(text)].length : Array.from(text).length;
    return {
      graphemes,
      codePoints: Array.from(text).length,
      units: text.length,
      bytes: utf8Length(text),
      invisible: chars.filter((c) => c.invisible).length,
    };
  }, [text, chars]);

  return (
    <ToolShell
      toolId="unicode"
      inputLabel={t("text")}
      outputLabel={t("characters")}
      defaultInputSize={35}
      onExample={() => setInput(EXAMPLE)}
      onClear={() => setInput("")}
      copyText={() => stripInvisible(text)}
      input={
        <CodeEditor
          value={input}
          onChange={setInput}
          lineWrapping
          ariaLabel={t("text")}
          placeholder={t("placeholder")}
        />
      }
      output={
        !text ? (
          <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
        ) : (
          <div>
            <dl className="flex flex-wrap gap-x-4 gap-y-1 border-b px-3 py-2 text-xs">
              {(["graphemes", "codePoints", "units", "bytes"] as const).map((k) => (
                <div key={k} className="flex gap-1">
                  <dt className="text-muted-foreground">{t(`stats.${k}`)}</dt>
                  <dd className="font-mono">{stats[k]}</dd>
                </div>
              ))}
              {stats.invisible > 0 && (
                <div className="flex items-center gap-1 text-warning" role="status">
                  <EyeOff className="size-3.5" aria-hidden />
                  {t("invisibleFound", { count: stats.invisible })}
                </div>
              )}
            </dl>
            <div className="flex flex-wrap gap-2 border-b px-3 py-2">
              <CopyButton text={() => stripInvisible(text)} label={t("copyClean")} variant="outline" />
              <CopyButton text={() => escapeForJs(text)} label={t("copyEscaped")} variant="outline" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">{t("char")}</th>
                    <th className="px-3 py-1.5 font-medium">{t("codePoint")}</th>
                    <th className="px-3 py-1.5 font-medium">{t("category")}</th>
                    <th className="px-3 py-1.5 font-medium">UTF-8</th>
                    <th className="px-3 py-1.5 font-medium">JS</th>
                    <th className="px-3 py-1.5 font-medium">HTML</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {chars.map((c, i) => (
                    <tr key={i} className={cn("border-t", c.invisible && "bg-warning/10")}>
                      <td className="px-3 py-1 text-base">{c.invisible || /\s/.test(c.char) ? "·" : c.char}</td>
                      <td className="px-3 py-1 text-accent-text">{c.label}</td>
                      <td className="px-3 py-1 text-xs">{c.name ?? t(`categories.${c.category}`)}</td>
                      <td className="px-3 py-1 text-xs text-muted-foreground">{c.utf8}</td>
                      <td className="px-3 py-1 text-xs">{c.js}</td>
                      <td className="px-3 py-1 text-xs">{c.html}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {Array.from(text).length > MAX_ROWS && (
                <p className="p-3 text-xs text-muted-foreground">{t("truncated", { max: MAX_ROWS })}</p>
              )}
            </div>
          </div>
        )
      }
    />
  );
}
