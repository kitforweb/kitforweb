"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeftRight, Check, Eraser, FlaskConical, Link2, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { getTool, type ToolId } from "@/config/tools";
import { CopyButton } from "./copy-button";
import { SplitPane } from "./split-pane";

export interface ToolShellProps {
  toolId: ToolId;
  input: ReactNode;
  output: ReactNode;
  inputLabel: string;
  outputLabel: string;
  /** Extra controls shown in each panel header. */
  inputActions?: ReactNode;
  outputActions?: ReactNode;
  /** Tool-specific controls for the main action bar. */
  toolbar?: ReactNode;
  onExample?: () => void;
  onClear?: () => void;
  onSwap?: () => void;
  /** Text copied by the main "Copy" action (usually the result). */
  copyText?: string | (() => string);
  /** Builds the share link (only for shareable, non-sensitive tools). */
  onShare?: () => string;
  defaultInputSize?: number;
}

function PanelHeader({ label, actions }: { label: string; actions?: ReactNode }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b bg-surface-1 px-3">
      <span className="truncate font-mono text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">{actions}</div>
    </div>
  );
}

/**
 * The skeleton every tool shares: input on the left, result on the right and a
 * fixed action bar (example, clear, swap, copy, share). Learn one, know them all.
 */
export function ToolShell({
  toolId,
  input,
  output,
  inputLabel,
  outputLabel,
  inputActions,
  outputActions,
  toolbar,
  onExample,
  onClear,
  onSwap,
  copyText,
  onShare,
  defaultInputSize,
}: ToolShellProps) {
  const t = useTranslations("common");
  const tool = getTool(toolId);
  const [shared, setShared] = useState(false);

  const share = async () => {
    if (!onShare) return;
    const link = onShare();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // The link is also in the address bar.
    }
    setShared(true);
    window.setTimeout(() => setShared(false), 1500);
  };

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-background md:h-full">
      <div
        role="toolbar"
        aria-label={t("actions")}
        className="flex min-h-11 shrink-0 flex-wrap items-center gap-1 border-b bg-surface-1 px-2 py-1.5"
      >
        {onExample && (
          <Button type="button" variant="ghost" size="sm" onClick={onExample}>
            <FlaskConical />
            {t("example")}
          </Button>
        )}
        {onClear && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <Eraser />
            {t("clear")}
          </Button>
        )}
        {onSwap && (
          <Button type="button" variant="ghost" size="sm" onClick={onSwap}>
            <ArrowLeftRight />
            {t("swap")}
          </Button>
        )}
        {toolbar && <div className="flex flex-wrap items-center gap-1 border-l ps-2">{toolbar}</div>}
        <div className="ms-auto flex items-center gap-1">
          {tool.sensitive && (
            <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
              <ShieldAlert className="size-3.5 text-warning" aria-hidden />
              {t("sensitive")}
            </span>
          )}
          {onShare && tool.shareable && !tool.sensitive && (
            <Button type="button" variant="ghost" size="sm" onClick={share}>
              {shared ? <Check className="text-success" /> : <Link2 />}
              {shared ? t("linkCopied") : t("share")}
            </Button>
          )}
          {copyText !== undefined && <CopyButton text={copyText} variant="default" />}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <SplitPane
          defaultStart={defaultInputSize}
          start={
            <section className="flex h-full min-h-0 flex-col" aria-label={inputLabel}>
              <PanelHeader label={inputLabel} actions={inputActions} />
              <div className="min-h-0 flex-1 overflow-auto">{input}</div>
            </section>
          }
          end={
            <section className="flex h-full min-h-0 flex-col" aria-label={outputLabel}>
              <PanelHeader label={outputLabel} actions={outputActions} />
              <div className="min-h-0 flex-1 overflow-auto">{output}</div>
            </section>
          }
        />
      </div>
    </div>
  );
}
