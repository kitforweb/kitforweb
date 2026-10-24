"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Command, House, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTool, type ToolId } from "@/config/tools";
import { useAppLocale } from "@/hooks/use-app-locale";
import { useWorkspace } from "@/hooks/use-workspace";
import { aboutPath, homePath, toolFromPath, toolPath } from "@/lib/routes";
import { workspaceActions } from "@/lib/workspace-store";
import { cn } from "cn";
import { useIde } from "./ide-context";

const tabClass = (active: boolean) =>
  cn(
    "group relative flex h-full shrink-0 items-center gap-2 border-e px-3 text-[13px] transition-colors",
    active
      ? "bg-background text-foreground before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary before:shadow-glow"
      : "bg-surface-1 text-muted-foreground hover:text-foreground",
  );

/** Open tools as tabs, like an editor. */
export function TabBar() {
  const t = useTranslations();
  const locale = useAppLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { tabs } = useWorkspace();
  const { openPalette } = useIde();
  const current = toolFromPath(pathname);

  // Every visit to a tool opens its tab and records it as recent.
  useEffect(() => {
    if (current) workspaceActions.visit(current);
  }, [current]);

  const close = (id: ToolId) => {
    if (id === current) {
      const i = tabs.indexOf(id);
      const next = tabs[i + 1] ?? tabs[i - 1];
      router.push(next ? toolPath(next, locale) : homePath(locale));
    }
    workspaceActions.closeTab(id);
  };

  const page =
    pathname === homePath(locale)
      ? { href: homePath(locale), label: t("nav.home"), Icon: House }
      : pathname === aboutPath(locale)
        ? { href: aboutPath(locale), label: t("nav.about"), Icon: UserRound }
        : null;

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b bg-surface-1">
      <nav
        aria-label={t("nav.openTabs")}
        className="flex min-w-0 flex-1 [scrollbar-width:none] items-stretch overflow-x-auto"
      >
        {page && (
          <Link href={page.href} aria-current="page" className={cn(tabClass(true), "italic")}>
            <page.Icon className="size-3.5 text-primary" aria-hidden />
            {page.label}
          </Link>
        )}
        {tabs.map((id) => {
          const tool = getTool(id);
          const active = id === current;
          const Icon = tool.icon;
          const name = t(`tools.${id}.name`);
          return (
            <div
              key={id}
              className={tabClass(active)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  close(id);
                }
              }}
            >
              <Link
                href={toolPath(id, locale)}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-2 outline-none after:absolute after:inset-0 focus-visible:underline"
              >
                <Icon className={cn("size-3.5", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span className="whitespace-nowrap">{name}</span>
              </Link>
              <button
                type="button"
                onClick={() => close(id)}
                aria-label={t("nav.closeTab", { name })}
                className={cn(
                  "relative z-10 grid size-5 place-items-center rounded text-muted-foreground hover:bg-surface-3 hover:text-foreground",
                  !active && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                )}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => openPalette()}
        className="hidden shrink-0 items-center gap-2 border-s px-3 text-xs text-muted-foreground hover:text-foreground sm:flex"
      >
        <Command className="size-3.5" aria-hidden />
        {t("palette.open")}
        <kbd className="rounded border bg-background px-1.5 font-mono text-[10px]">Ctrl K</kbd>
      </button>
    </div>
  );
}
