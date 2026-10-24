"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ClipboardPaste, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { getTool, type ToolId } from "@/config/tools";
import { useAppLocale } from "@/hooks/use-app-locale";
import { detectTools } from "@/lib/detect-tools";
import { handoff } from "@/lib/handoff";
import { toolPath } from "@/lib/routes";
import { detectKind } from "@/lib/utils/detect/detectors";

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable;
}

/**
 * "Paste and go": recognises what was pasted and opens the right tool with the
 * content already loaded. Content travels through memory, never the URL.
 */
export function SmartDetector() {
  const t = useTranslations();
  const locale = useAppLocale();
  const router = useRouter();
  const [text, setText] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  const resolution = useMemo(() => (text.trim() ? detectTools(text) : null), [text]);
  const kind = useMemo(() => (text.trim() ? detectKind(text)?.kind : undefined), [text]);

  const open = (id: ToolId, content: string) => {
    handoff.put(id, content);
    router.push(toolPath(id, locale));
  };

  const handlePasted = (content: string) => {
    setText(content);
    const r = detectTools(content);
    if (r.auto) open(r.auto.toolId, content);
  };

  // Ctrl+V anywhere on the home page (with nothing focused/selected) goes to the detector.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(document.activeElement)) return;
      if (window.getSelection()?.toString()) return;
      const content = e.clipboardData?.getData("text") ?? "";
      if (!content.trim()) return;
      e.preventDefault();
      area.current?.focus();
      handlePasted(content);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  return (
    <section aria-labelledby="detector-title" className="rounded-xl border bg-surface-1 p-4 shadow-glow md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <h2 id="detector-title" className="font-heading text-sm font-semibold">
          {t("detector.title")}
        </h2>
        <kbd className="ms-auto hidden rounded border bg-background px-1.5 font-mono text-[10px] text-muted-foreground sm:inline">
          Ctrl V
        </kbd>
      </div>
      <textarea
        ref={area}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          const content = e.clipboardData.getData("text");
          if (content.trim()) {
            e.preventDefault();
            handlePasted(content);
          }
        }}
        rows={5}
        spellCheck={false}
        placeholder={t("detector.placeholder")}
        aria-label={t("detector.title")}
        aria-describedby="detector-result"
        className="w-full resize-y rounded-lg border bg-editor p-3 font-mono text-[13px] leading-6 outline-none placeholder:text-muted-foreground focus:border-primary focus:shadow-glow"
      />
      <div id="detector-result" role="status" className="mt-3 flex min-h-8 flex-wrap items-center gap-2 text-sm">
        {!text.trim() ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <ClipboardPaste className="size-4" aria-hidden />
            {t("detector.hint")}
          </span>
        ) : resolution && resolution.candidates.length > 0 ? (
          <>
            <span className="text-muted-foreground">
              {t("detector.looksLike", { kind: t(`kinds.${resolution.candidates[0].kind}`) })}
            </span>
            {resolution.candidates.map((c, i) => {
              const Icon = getTool(c.toolId).icon;
              return (
                <Button
                  key={c.toolId}
                  type="button"
                  size="sm"
                  variant={i === 0 ? "default" : "outline"}
                  onClick={() => open(c.toolId, text)}
                >
                  <Icon aria-hidden />
                  {i > 0 && t("detector.or")} {t(`tools.${c.toolId}.name`)}
                  <ArrowRight aria-hidden />
                </Button>
              );
            })}
          </>
        ) : (
          <span className="text-muted-foreground">
            {kind ? t("detector.noToolYet", { kind: t(`kinds.${kind}`) }) : t("detector.nothing")}
          </span>
        )}
      </div>
    </section>
  );
}
