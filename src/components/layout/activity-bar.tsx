"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, House, Search, Settings, Star, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppLocale } from "@/hooks/use-app-locale";
import { homePath } from "@/lib/routes";
import { cn } from "cn";
import { useIde, type ExplorerView } from "./ide-context";

const itemClass = (active: boolean) =>
  cn(
    "relative grid size-12 place-items-center text-muted-foreground transition-colors hover:text-foreground",
    "before:absolute before:inset-y-2 before:start-0 before:w-0.5 before:rounded-full before:transition-colors",
    active && "text-foreground before:bg-primary before:shadow-glow",
  );

function BarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} aria-pressed={active} onClick={onClick} className={itemClass(active)}>
          <Icon className="size-5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Icon-only bar on the far left (desktop). */
export function ActivityBar() {
  const t = useTranslations("nav");
  const locale = useAppLocale();
  const pathname = usePathname();
  const { explorerOpen, explorerView, showView, settingsOpen, setSettingsOpen } = useIde();
  const viewActive = (v: ExplorerView) => explorerOpen && explorerView === v;
  const isHome = pathname === homePath(locale);

  return (
    <nav aria-label={t("activity")} className="hidden w-12 shrink-0 flex-col border-e bg-surface-2 md:flex">
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={homePath(locale)}
            aria-label={t("home")}
            aria-current={isHome ? "page" : undefined}
            className={itemClass(isHome)}
          >
            <House className="size-5" aria-hidden />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{t("home")}</TooltipContent>
      </Tooltip>
      <BarButton
        icon={Search}
        label={t("search")}
        active={viewActive("tools")}
        onClick={() => showView("tools", { toggle: true })}
      />
      <BarButton
        icon={Star}
        label={t("favorites")}
        active={viewActive("favorites")}
        onClick={() => showView("favorites", { toggle: true })}
      />
      <BarButton
        icon={History}
        label={t("recents")}
        active={viewActive("recents")}
        onClick={() => showView("recents", { toggle: true })}
      />
      <div className="mt-auto">
        <BarButton icon={Settings} label={t("settings")} active={settingsOpen} onClick={() => setSettingsOpen(true)} />
      </div>
    </nav>
  );
}

/** Bottom navigation that replaces the activity bar on small screens. */
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
      <Link
        href={homePath(locale)}
        className={btn}
        aria-current={pathname === homePath(locale) && !mobileExplorerOpen ? "page" : undefined}
        onClick={closeMobileExplorer}
      >
        <House className="size-5" aria-hidden />
        {t("home")}
      </Link>
      {(
        [
          ["tools", Search, t("search")],
          ["favorites", Star, t("favorites")],
          ["recents", History, t("recents")],
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
