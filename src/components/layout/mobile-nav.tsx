"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppLocale } from "@/hooks/use-app-locale";
import { homePath } from "@/lib/routes";
import { useIde, type ExplorerView } from "./ide-context";

/** Bottom navigation on small screens. Desktop has the explorer always visible instead. */
export function MobileNav() {
  const t = useTranslations("nav");
  const locale = useAppLocale();
  const pathname = usePathname();
  const { mobileExplorerOpen, explorerView, showView, closeMobileExplorer, setSettingsOpen } = useIde();
  const viewActive = (v: ExplorerView) => mobileExplorerOpen && explorerView === v;
  const btn =
    "flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] text-muted-foreground aria-[current=page]:text-primary aria-pressed:text-primary";

  return (
    <nav aria-label={t("activity")} className="flex shrink-0 border-t bg-surface-2 md:hidden">
      {/* Home is just the brand icon, as tall as the other items (icon + label). */}
      <Link
        href={homePath(locale)}
        className="flex flex-1 items-center justify-center py-1.5"
        aria-label={t("home")}
        aria-current={pathname === homePath(locale) && !mobileExplorerOpen ? "page" : undefined}
        onClick={closeMobileExplorer}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={36} height={36} className="size-9" />
      </Link>
      {(
        [
          ["tools", Search, t("search")],
          ["favorites", Star, t("favorites")],
        ] as const
      ).map(([view, Icon, label]) => (
        <button
          key={view}
          type="button"
          className={btn}
          aria-pressed={viewActive(view)}
          onClick={() => (viewActive(view) ? closeMobileExplorer() : showView(view, { focusSearch: view === "tools" }))}
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </button>
      ))}
      <button type="button" className={btn} onClick={() => setSettingsOpen(true)}>
        <Settings className="size-5" aria-hidden />
        {t("settings")}
      </button>
    </nav>
  );
}
