"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { House, Moon, Settings, Sparkles, Sun, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { getTool, tools, type ToolId } from "@/config/tools";
import { useAppLocale } from "@/hooks/use-app-locale";
import { useWorkspace } from "@/hooks/use-workspace";
import { detectTools } from "@/lib/detect-tools";
import { handoff } from "@/lib/handoff";
import { aboutPath, homePath, toolPath } from "@/lib/routes";
import { matchesQuery, matchRank } from "@/lib/utils/search/match";
import { workspaceActions } from "@/lib/workspace-store";
import { useIde } from "./ide-context";

/** Loaded on demand the first time the palette opens. */
export default function PaletteDialog() {
  const t = useTranslations("palette");
  const { paletteOpen, setPaletteOpen, paletteQuery } = useIde();
  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} title={t("title")} description={t("description")}>
      {/* The dialog unmounts its content when closed, so each opening starts fresh. */}
      <PaletteBody initialQuery={paletteQuery} />
    </CommandDialog>
  );
}

function PaletteBody({ initialQuery }: { initialQuery: string }) {
  const t = useTranslations();
  const locale = useAppLocale();
  const router = useRouter();
  const { theme } = useWorkspace();
  const { setPaletteOpen, setSettingsOpen } = useIde();
  const [query, setQuery] = useState(initialQuery);
  // Raw pasted text: <input> drops newlines, but detectors need them.
  const [pasted, setPasted] = useState<string | null>(initialQuery.includes("\n") ? initialQuery : null);

  const content = pasted ?? query;
  const detection = useMemo(() => (content.trim().length > 1 ? detectTools(content) : null), [content]);
  const results = useMemo(
    () =>
      tools
        .filter((tool) =>
          matchesQuery(pasted ? "" : query, [
            t(`tools.${tool.id}.name`),
            t(`tools.${tool.id}.short`),
            ...tool.keywords,
          ]),
        )
        .map((tool) => ({ tool, rank: pasted ? 2 : matchRank(query, t(`tools.${tool.id}.name`)) }))
        .sort((a, b) => a.rank - b.rank)
        .map(({ tool }) => tool),
    [query, pasted, t],
  );

  const go = (href: string) => {
    setPaletteOpen(false);
    router.push(href);
  };

  const openWith = (id: ToolId) => {
    handoff.put(id, content);
    go(toolPath(id, locale));
  };

  const showDetected = detection && detection.candidates.length > 0;
  const showTools = !pasted && results.length > 0;

  return (
    <Command shouldFilter={false} loop>
      <CommandInput
        value={pasted ? pasted.split("\n")[0] + " …" : query}
        onValueChange={(v) => {
          setPasted(null);
          setQuery(v);
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (text.includes("\n")) {
            e.preventDefault();
            setPasted(text);
          }
        }}
        placeholder={t("palette.placeholder")}
      />
      <CommandList className="max-h-96">
        {!showDetected && !showTools && <CommandEmpty>{t("palette.empty")}</CommandEmpty>}
        {showDetected && (
          <CommandGroup heading={t("palette.detected")}>
            {detection.candidates.map((c) => (
              <CommandItem key={c.toolId} value={`detect-${c.toolId}`} onSelect={() => openWith(c.toolId)}>
                <Sparkles className="text-primary" aria-hidden />
                {t("palette.openWith", {
                  kind: t(`kinds.${c.kind}`),
                  tool: t(`tools.${c.toolId}.name`),
                })}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {showTools && (
          <CommandGroup heading={t("palette.tools")}>
            {results.map((tool) => {
              const Icon = getTool(tool.id).icon;
              return (
                <CommandItem key={tool.id} value={tool.id} onSelect={() => go(toolPath(tool.id, locale))}>
                  <Icon aria-hidden />
                  <span>{t(`tools.${tool.id}.name`)}</span>
                  <span className="ms-auto truncate text-xs text-muted-foreground">{t(`tools.${tool.id}.short`)}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        {!pasted && !query && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("palette.pages")}>
              <CommandItem value="home" onSelect={() => go(homePath(locale))}>
                <House aria-hidden />
                {t("nav.home")}
              </CommandItem>
              <CommandItem value="about" onSelect={() => go(aboutPath(locale))}>
                <UserRound aria-hidden />
                {t("nav.about")}
              </CommandItem>
              <CommandItem
                value="settings"
                onSelect={() => {
                  setPaletteOpen(false);
                  setSettingsOpen(true);
                }}
              >
                <Settings aria-hidden />
                {t("nav.settings")}
              </CommandItem>
              <CommandItem
                value="theme"
                onSelect={() => workspaceActions.setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
                {theme === "dark" ? t("settings.light") : t("settings.dark")}
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );
}
