"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { House, Search, Star, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/shared/logo";
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-2 pt-3 pb-1 font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

export function Explorer() {
  const t = useTranslations();
  const locale = useAppLocale();
  const pathname = usePathname();
  const { explorerOpen, mobileExplorerOpen, explorerView, searchRef, closeMobileExplorer } = useIde();
  const { favorites } = useWorkspace();
  const [query, setQuery] = useState("");

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

  const pinned = favs.length > 0 && (
    <>
      <SectionTitle>{t("nav.favorites")}</SectionTitle>
      <ul>
        {favs.map((tool) => (
          <ToolRow key={tool.id} tool={tool} favorite />
        ))}
      </ul>
    </>
  );

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
        <div className="flex h-11 shrink-0 items-center border-b px-3">
          <Link href={homePath(locale)} onClick={closeMobileExplorer} className="rounded-sm text-foreground">
            <Logo className="h-4 w-auto" />
          </Link>
        </div>
        <div className="flex h-9 shrink-0 items-center justify-between px-3">
          <span className="font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {title}
          </span>
          <button
            type="button"
            className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground md:hidden"
            onClick={closeMobileExplorer}
            aria-label={t("common.close")}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="shrink-0 px-2 pb-2">
          <div className="relative">
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
              {!searching && (
                <ul>
                  <li>
                    <Link
                      href={homePath(locale)}
                      className={rowClass(pathname === homePath(locale))}
                      aria-current={pathname === homePath(locale) ? "page" : undefined}
                      onClick={closeMobileExplorer}
                    >
                      <House className="size-4 shrink-0" aria-hidden />
                      {t("nav.home")}
                    </Link>
                  </li>
                </ul>
              )}
              {!searching && pinned}
              {visible.size === 0 && (
                <p className="px-2 py-3 text-xs text-muted-foreground">{t("explorer.noResults")}</p>
              )}
              {groupedTools().map((group, i) => {
                const items = group.filter((tool) => visible.has(tool.id));
                if (items.length === 0) return null;
                return (
                  <Fragment key={i}>
                    <hr className="my-2 border-border/70" />
                    <ul>
                      {items.map((tool) => (
                        <ToolRow key={tool.id} tool={tool} favorite={favorites.includes(tool.id)} />
                      ))}
                    </ul>
                  </Fragment>
                );
              })}
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
    </>
  );
}
