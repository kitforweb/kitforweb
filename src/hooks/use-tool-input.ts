"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { getTool, type ToolId } from "@/config/tools";
import { handoff } from "@/lib/handoff";
import { readStorage, writeStorage } from "@/lib/storage";
import { workspaceStore } from "@/lib/workspace-store";
import { useWorkspace } from "./use-workspace";

const storageKey = (toolId: ToolId, field: string) => `input:${toolId}:${field}`;

interface ToolInputOptions {
  field?: string;
  /** Higher-priority initial value, e.g. state from a share link. */
  initial?: () => string | null;
}

/**
 * Initial value of a tool input, by priority: content handed off by the smart
 * detector → `initial` → last persisted input → `fallback`. Tools render
 * client-only (ssr: false), so reading storage here is safe.
 */
export function initialToolInput(
  toolId: ToolId,
  fallback: string,
  { field = "main", initial }: ToolInputOptions = {},
): string {
  const handed = field === "main" ? handoff.peek(toolId) : undefined;
  if (handed !== undefined) return handed;
  const preferred = initial?.();
  if (preferred != null) return preferred;
  if (!getTool(toolId).sensitive && workspaceStore.getSnapshot().persistInputs) {
    const stored = readStorage(storageKey(toolId, field));
    if (stored !== null) return stored;
  }
  return fallback;
}

/**
 * Remembers `value` in this browser (debounced). Sensitive tools never
 * persist, and the user can disable persistence in Settings.
 */
export function usePersistInput(toolId: ToolId, value: string, field = "main"): void {
  const { sensitive } = getTool(toolId);
  const { persistInputs } = useWorkspace();
  const canPersist = persistInputs && !sensitive;

  useEffect(() => {
    if (field === "main") handoff.clear(toolId);
  }, [toolId, field]);

  useEffect(() => {
    if (!canPersist) {
      writeStorage(storageKey(toolId, field), null);
      return;
    }
    const id = window.setTimeout(() => writeStorage(storageKey(toolId, field), value), 300);
    return () => window.clearTimeout(id);
  }, [canPersist, toolId, field, value]);
}

/** Main text input of a tool: initial value from initialToolInput, persisted with usePersistInput. */
export function useToolInput(
  toolId: ToolId,
  fallback: string,
  options: ToolInputOptions = {},
): [string, Dispatch<SetStateAction<string>>] {
  const [value, setValue] = useState<string>(() => initialToolInput(toolId, fallback, options));
  usePersistInput(toolId, value, options.field);
  return [value, setValue];
}
