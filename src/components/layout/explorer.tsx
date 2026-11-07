"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Search, Settings, Star, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/shared/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { groupedTools, getTool, tools, type ToolDefinition, type ToolId } from "@/config/tools";
import { useAppLocale } from "@/hooks/use-app-locale";
import { useWorkspace } from "@/hooks/use-workspace";
import { aboutPath, homePath, toolPath } from "@/lib/routes";
import { matchesQuery } from "@/lib/utils/search/match";
import { workspaceActions } from "@/lib/workspace-store";
import { cn } from "cn";
import { useIde } from "./ide-context";

const rowClass = (active: boolean) =>
  cn(
    "group flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground",
    active && "bg-accent text-foreground shadow-[inset_2px_0_0_var(--primary)]",
  );

function ToolRow({ tool, favorite }: { tool: ToolDefinition; favorite: boolean }) {
  const t = useTranslations();
  const locale = useAppLocale();
  const pathname = usePathname();
  const { closeMobileExplorer } = useIde();
  const href = toolPath(tool.id, locale);
  const active = pathname === href;
  const Icon = tool.icon;
  const name = t(`tools.${tool.id}.name`);

  return (
    <li className="relative">
      <Link
        href={href}
        className={rowClass(active)}
        aria-current={active ? "page" : undefined}
        onClick={closeMobileExplorer}
      >
        <Icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden />
        <span className="truncate pe-6">{name}</span>
      </Link>
      <button
        type="button"
        onClick={() => workspaceActions.toggleFavorite(tool.id)}
        aria-label={favorite ? t("explorer.removeFavorite", { name }) : t("explorer.addFavorite", { name })}
        aria-pressed={favorite}
        className={cn(
          "absolute inset-y-0 end-1 my-auto grid size-6 place-items-center rounded text-muted-foreground hover:text-primary focus-visible:opacity-100",
          favorite ? "opacity-100" : "opacity-0 group-hover:opacity-100 [li:hover_&]:opacity-100",
        )}
      >
        <Star className={cn("size-3.5", favorite && "fill-primary text-primary")} aria-hidden />
      </button>
    </li>
  );
}

const iconButton =
  "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground";

/** Desktop rail shown while the explorer is collapsed: home (brand icon), expand, about and settings. */
function CollapsedRail() {
  const t = useTranslations();
  const locale = useAppLocale();
  const pathname = usePathname();
  const { setExplorerOpen, setSettingsOpen } = useIde();

  const item = (label: string, child: React.ReactNode) => (
    <Tooltip>
      <TooltipTrigger asChild>{child}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <nav
      aria-label={t("nav.explorer")}
      className="hidden w-12 shrink-0 flex-col items-center gap-1 border-e bg-surface-1 py-2 md:flex"
    >
      {item(
        t("nav.home"),
        <Link href={homePath(locale)} aria-label={t("nav.home")} className="mb-1 rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={32} height={32} className="size-8" />
        </Link>,
      )}
      {item(
        t("explorer.expand"),
        <button
          type="button"
          className={iconButton}
          onClick={() => setExplorerOpen(true)}
          aria-label={t("explorer.expand")}
        >
          <PanelLeftOpen className="size-4" aria-hidden />
        </button>,
      )}
      {item(
        t("nav.about"),
        <Link
          href={aboutPath(locale)}
          aria-label={t("nav.about")}
          aria-current={pathname === aboutPath(locale) ? "page" : undefined}
          className={cn(iconButton, "aria-[current=page]:text-primary")}
        >
          <UserRound className="size-4" aria-hidden />
        </Link>,
      )}
      <div className="mt-auto">
        {item(
          t("nav.settings"),
          <button
            type="button"
            className={iconButton}
            onClick={() => setSettingsOpen(true)}
            aria-label={t("nav.settings")}
          >
            <Settings className="size-4" aria-hidden />
          </button>,
        )}
      </div>
    </nav>
  );
}

export function Explorer() {
  const t = useTranslations();
  const locale = useAppLocale();
  const pathname = usePathname();
  const { explorerOpen, setExplorerOpen, mobileExplorerOpen, explorerView, showView, searchRef, closeMobileExplorer } =
    useIde();
  const { favorites } = useWorkspace();
  const [query, setQuery] = useState("");
  const favoritesOnly = explorerView === "favorites";

  const visible = useMemo(() => {
    const match = (tool: ToolDefinition) =>
      matchesQuery(query, [
        t(`tools.${tool.id}.name`),
        t(`tools.${tool.id}.short`),
        ...tool.keywords,
        tool.slugs[locale],
      ]);
    return new Set(tools.filter(match).map((x) => x.id));
  }, [query, t, locale]);

  const list = (ids: ToolId[]) => ids.filter((id) => visible.has(id)).map(getTool);
  const favs = list(favorites);
  const searching = query.trim() !== "";
  const title = t(`nav.${explorerView === "tools" ? "explorer" : explorerView}`);

  return (
    <>
      {mobileExplorerOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden"
          onClick={closeMobileExplorer}
          aria-hidden
        />
      )}
      <aside
        aria-label={title}
        className={cn(
          "flex-col border-e bg-surface-1",
          // Mobile: overlay drawer above the bottom nav. Desktop: collapsible side panel.
          "fixed inset-y-0 start-0 bottom-12 z-40 w-[min(20rem,85vw)] shadow-2xl md:static md:z-auto md:w-64 md:shadow-none",
          mobileExplorerOpen ? "flex" : "hidden",
          explorerOpen ? "md:flex" : "md:hidden",
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b ps-3 pe-2">
          <Link href={homePath(locale)} onClick={closeMobileExplorer} className="rounded-sm text-foreground">
            <Logo className="h-5 w-auto" />
          </Link>
          <button
            type="button"
            className={cn(iconButton, "hidden md:grid")}
            onClick={() => setExplorerOpen(false)}
            aria-label={t("explorer.collapse")}
            title={t("explorer.collapse")}
          >
            <PanelLeftClose className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={cn(iconButton, "md:hidden")}
            onClick={closeMobileExplorer}
            aria-label={t("common.close")}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1 p-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute inset-y-0 start-2 my-auto size-3.5 text-muted-foreground"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder={t("explorer.searchPlaceholder")}
              aria-label={t("explorer.searchPlaceholder")}
              className="h-8 w-full rounded-md border bg-background ps-7 pe-2 text-[13px] outline-none placeholder:text-muted-foreground focus:border-primary focus:shadow-glow"
            />
          </div>
          {/* Filters the list (and the search) to the favorite tools. */}
          <button
            type="button"
            className={cn(iconButton, "size-8 shrink-0 border", favoritesOnly && "border-primary/60 text-primary")}
            onClick={() => showView(favoritesOnly ? "tools" : "favorites")}
            aria-pressed={favoritesOnly}
            aria-label={t("explorer.favoritesOnly")}
            title={t("explorer.favoritesOnly")}
          >
            <Star className={cn("size-4", favoritesOnly && "fill-primary")} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {explorerView === "favorites" ? (
            favs.length ? (
              <ul>
                {favs.map((tool) => (
                  <ToolRow key={tool.id} tool={tool} favorite />
                ))}
              </ul>
            ) : (
              <p className="px-2 py-3 text-xs leading-5 text-muted-foreground">{t("explorer.noFavorites")}</p>
            )
          ) : (
            <>
              {/* No "Home" row (the logo links home) and no favorites block (the star filters them). */}
              {visible.size === 0 && (
                <p className="px-2 py-3 text-xs text-muted-foreground">{t("explorer.noResults")}</p>
              )}
              {groupedTools()
                .map((group) => group.filter((tool) => visible.has(tool.id)))
                .filter((items) => items.length > 0)
                .map((items, i) => (
                  <Fragment key={items[0].id}>
                    {i > 0 && <hr className="my-2 border-border/70" />}
                    <ul>
                      {items.map((tool) => (
                        <ToolRow key={tool.id} tool={tool} favorite={favorites.includes(tool.id)} />
                      ))}
                    </ul>
                  </Fragment>
                ))}
              {!searching && (
                <>
                  <hr className="my-2 border-border/70" />
                  <ul>
                    <li>
                      <Link
                        href={aboutPath(locale)}
                        className={rowClass(pathname === aboutPath(locale))}
                        aria-current={pathname === aboutPath(locale) ? "page" : undefined}
                        onClick={closeMobileExplorer}
                      >
                        <UserRound className="size-4 shrink-0" aria-hidden />
                        {t("nav.about")}
                      </Link>
                    </li>
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </aside>
      {!explorerOpen && <CollapsedRail />}
    </>
  );
}
