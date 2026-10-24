"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Languages, Moon, ShieldCheck, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppLocale } from "@/hooks/use-app-locale";
import { useWorkspace } from "@/hooks/use-workspace";
import { statusStore } from "@/lib/status-store";
import { formatBytes } from "@/lib/utils/format/bytes";
import { workspaceActions } from "@/lib/workspace-store";
import { LocaleLinks } from "./locale-links";

const item = "flex h-full items-center gap-1.5 px-2 hover:bg-surface-3 hover:text-foreground";

export function StatusBar() {
  const t = useTranslations();
  const locale = useAppLocale();
  const pathname = usePathname();
  const status = useSyncExternalStore(statusStore.subscribe, statusStore.getSnapshot, statusStore.getServerSnapshot);
  const { theme } = useWorkspace();
  const [langOpen, setLangOpen] = useState(false);

  // Editor info belongs to the page that published it.
  useEffect(() => {
    statusStore.set(null);
  }, [pathname]);

  const nf = new Intl.NumberFormat(locale);

  return (
    <footer className="flex h-6 shrink-0 items-stretch justify-between border-t bg-surface-2 font-mono text-[11px] text-muted-foreground">
      <div className="flex min-w-0 items-stretch">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`${item} text-accent-text`} tabIndex={0}>
              <ShieldCheck className="size-3.5" aria-hidden />
              {t("status.local")}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs font-sans">
            {t("status.localHint")}
          </TooltipContent>
        </Tooltip>
        {status?.kind && (
          <span className={item} data-testid="status-kind">
            {t("status.detected", { kind: t(`kinds.${status.kind}`) })}
          </span>
        )}
      </div>
      <div className="flex items-stretch">
        {status && (
          <>
            <span className={`${item} hidden sm:flex`}>
              {t("status.position", { line: status.line, column: status.column })}
            </span>
            <span className={`${item} hidden sm:flex`}>{t("status.chars", { count: nf.format(status.chars) })}</span>
            <span className={`${item} hidden sm:flex`}>{formatBytes(status.bytes, locale)}</span>
          </>
        )}
        <Popover open={langOpen} onOpenChange={setLangOpen}>
          <PopoverTrigger asChild>
            <button type="button" className={item} aria-label={`${t("settings.language")}: ${locale.toUpperCase()}`}>
              <Languages className="size-3.5" aria-hidden />
              {locale.toUpperCase()}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-52 p-1">
            <LocaleLinks onNavigate={() => setLangOpen(false)} />
          </PopoverContent>
        </Popover>
        <button
          type="button"
          className={item}
          onClick={() => workspaceActions.setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? t("settings.light") : t("settings.dark")}
        >
          {theme === "dark" ? <Sun className="size-3.5" aria-hidden /> : <Moon className="size-3.5" aria-hidden />}
        </button>
      </div>
    </footer>
  );
}
