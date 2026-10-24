"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppLocale } from "@/hooks/use-app-locale";
import { homePath } from "@/lib/routes";
import { useIde } from "./ide-context";

// cmdk and the dialog only download when the palette is first opened.
const PaletteDialog = dynamic(() => import("./palette-dialog"), { ssr: false });

/** Global Ctrl/Cmd+K shortcut and the palette itself (lazy). */
export function CommandPalette() {
  const locale = useAppLocale();
  const pathname = usePathname();
  const { paletteOpen, setPaletteOpen, openPalette } = useIde();
  const [loaded, setLoaded] = useState(false);
  if (paletteOpen && !loaded) setLoaded(true);

  // Ctrl/Cmd + K anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (paletteOpen) setPaletteOpen(false);
        else openPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, openPalette, setPaletteOpen]);

  // WebSite SearchAction: /{locale}?q=… opens the palette with the query.
  useEffect(() => {
    if (pathname !== homePath(locale)) return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) openPalette(q);
  }, [pathname, locale, openPalette]);

  return loaded ? <PaletteDialog /> : null;
}
