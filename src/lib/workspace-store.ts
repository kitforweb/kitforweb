import { isToolId, type ToolId } from "@/config/tools";
import { readStorage, writeStorage } from "./storage";

export type Theme = "dark" | "light";

export interface WorkspaceState {
  favorites: ToolId[];
  tabs: ToolId[];
  theme: Theme;
  /** Remember the last input of each (non-sensitive) tool. */
  persistInputs: boolean;
}

const KEY = "workspace";
const MAX_TABS = 8;

export const defaultWorkspace: WorkspaceState = {
  favorites: [],
  tabs: [],
  theme: "dark",
  persistInputs: true,
};

const toolList = (v: unknown): ToolId[] =>
  Array.isArray(v) ? v.filter((x): x is ToolId => typeof x === "string" && isToolId(x)) : [];

function load(): WorkspaceState {
  const raw = readStorage(KEY);
  if (!raw) return defaultWorkspace;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof WorkspaceState, unknown>>;
    return {
      favorites: toolList(v.favorites),
      tabs: toolList(v.tabs).slice(0, MAX_TABS),
      theme: v.theme === "light" ? "light" : "dark",
      persistInputs: v.persistInputs !== false,
    };
  } catch {
    return defaultWorkspace;
  }
}

let state: WorkspaceState | null = null;
const listeners = new Set<() => void>();

export const workspaceStore = {
  getSnapshot(): WorkspaceState {
    if (state === null) state = typeof window === "undefined" ? defaultWorkspace : load();
    return state;
  },
  getServerSnapshot(): WorkspaceState {
    return defaultWorkspace;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  update(fn: (s: WorkspaceState) => WorkspaceState): void {
    state = fn(workspaceStore.getSnapshot());
    writeStorage(KEY, JSON.stringify(state));
    listeners.forEach((l) => l());
  },
};

const without = (list: ToolId[], id: ToolId) => list.filter((x) => x !== id);

export const workspaceActions = {
  toggleFavorite(id: ToolId) {
    workspaceStore.update((s) => ({
      ...s,
      favorites: s.favorites.includes(id) ? without(s.favorites, id) : [...s.favorites, id],
    }));
  },
  /** Called whenever a tool page is shown: opens its tab. */
  visit(id: ToolId) {
    workspaceStore.update((s) => ({
      ...s,
      tabs: s.tabs.includes(id) ? s.tabs : [...s.tabs, id].slice(-MAX_TABS),
    }));
  },
  closeTab(id: ToolId) {
    workspaceStore.update((s) => ({ ...s, tabs: without(s.tabs, id) }));
  },
  closeOtherTabs(id: ToolId) {
    workspaceStore.update((s) => ({ ...s, tabs: s.tabs.filter((x) => x === id) }));
  },
  setTheme(theme: Theme) {
    workspaceStore.update((s) => ({ ...s, theme }));
    document.documentElement.classList.toggle("dark", theme === "dark");
  },
  setPersistInputs(persistInputs: boolean) {
    workspaceStore.update((s) => ({ ...s, persistInputs }));
  },
  reset() {
    state = defaultWorkspace;
    listeners.forEach((l) => l());
    document.documentElement.classList.add("dark");
  },
};

/** Inline script for <head>: applies the stored theme before first paint. */
export const themeBootScript = `try{var w=JSON.parse(localStorage.getItem("kfw:${KEY}")||"{}");if(w.theme==="light")document.documentElement.classList.remove("dark")}catch(e){}`;
