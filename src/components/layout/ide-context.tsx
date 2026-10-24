"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

export type ExplorerView = "tools" | "favorites" | "recents";

interface IdeContextValue {
  explorerOpen: boolean;
  /** On small screens the explorer is an overlay, closed by default. */
  mobileExplorerOpen: boolean;
  explorerView: ExplorerView;
  /** Shows a view; selecting the visible view again collapses the explorer (like VS Code). */
  showView: (view: ExplorerView, opts?: { toggle?: boolean; focusSearch?: boolean }) => void;
  closeMobileExplorer: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
  paletteOpen: boolean;
  paletteQuery: string;
  openPalette: (query?: string) => void;
  setPaletteOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

const IdeContext = createContext<IdeContextValue | null>(null);

export function IdeProvider({ children }: { children: ReactNode }) {
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false);
  const [explorerView, setExplorerView] = useState<ExplorerView>("tools");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const showView = useCallback<IdeContextValue["showView"]>(
    (view, { toggle = false, focusSearch = false } = {}) => {
      if (toggle && explorerOpen && explorerView === view && !focusSearch) {
        setExplorerOpen(false);
        setMobileExplorerOpen(false);
        return;
      }
      setExplorerView(view);
      setExplorerOpen(true);
      setMobileExplorerOpen(true);
      if (focusSearch) requestAnimationFrame(() => searchRef.current?.focus());
    },
    [explorerOpen, explorerView],
  );

  const openPalette = useCallback((query = "") => {
    setPaletteQuery(query);
    setPaletteOpen(true);
  }, []);

  const value = useMemo<IdeContextValue>(
    () => ({
      explorerOpen,
      explorerView,
      showView,
      mobileExplorerOpen,
      closeMobileExplorer: () => setMobileExplorerOpen(false),
      searchRef,
      paletteOpen,
      paletteQuery,
      openPalette,
      setPaletteOpen,
      settingsOpen,
      setSettingsOpen,
    }),
    [explorerOpen, mobileExplorerOpen, explorerView, showView, paletteOpen, paletteQuery, openPalette, settingsOpen],
  );

  return <IdeContext.Provider value={value}>{children}</IdeContext.Provider>;
}

export function useIde(): IdeContextValue {
  const ctx = useContext(IdeContext);
  if (!ctx) throw new Error("useIde must be used inside <IdeProvider>");
  return ctx;
}
