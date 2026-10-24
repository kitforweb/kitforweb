"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActivityBar, MobileNav } from "./activity-bar";
import { CommandPalette } from "./command-palette";
import { Explorer } from "./explorer";
import { IdeProvider, useIde } from "./ide-context";
import { StatusBar } from "./status-bar";
import { TabBar } from "./tab-bar";

const SettingsDialog = dynamic(() => import("./settings-dialog").then((m) => m.SettingsDialog), { ssr: false });

/** Settings code downloads the first time the dialog opens. */
function LazySettings() {
  const { settingsOpen } = useIde();
  const [loaded, setLoaded] = useState(false);
  if (settingsOpen && !loaded) setLoaded(true);
  return loaded ? <SettingsDialog /> : null;
}

/** VS Code-like frame: activity bar, explorer, tabs, content and status bar. */
export function IdeShell({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  return (
    <TooltipProvider delayDuration={400}>
      <IdeProvider>
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-2 focus:top-2"
        >
          {t("skip")}
        </a>
        <div className="flex h-dvh flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1">
            <ActivityBar />
            <Explorer />
            <div className="flex min-w-0 flex-1 flex-col">
              <TabBar />
              <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
                {children}
              </main>
            </div>
          </div>
          <StatusBar />
          <MobileNav />
        </div>
        <CommandPalette />
        <LazySettings />
      </IdeProvider>
    </TooltipProvider>
  );
}
