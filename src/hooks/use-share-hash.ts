"use client";

import { useCallback } from "react";
import { getTool, type ToolId } from "@/config/tools";
import { decodeShareState, encodeShareState } from "@/lib/utils/share/hash";

/**
 * Share-by-link through the URL fragment, which never reaches any server.
 * Disabled for tools that are not `shareable` or are `sensitive`.
 */
export function useShareHash<T>(toolId: ToolId, guard: (v: unknown) => v is T) {
  const { shareable, sensitive } = getTool(toolId);
  const enabled = shareable && !sensitive;

  /** State present in the current URL hash, if any. Call during init. */
  const readInitial = useCallback((): T | null => {
    if (!enabled || typeof window === "undefined") return null;
    return decodeShareState(window.location.hash, guard);
  }, [enabled, guard]);

  /** Writes `state` into the hash and returns the full link. */
  const createLink = useCallback((state: T): string => {
    const url = new URL(window.location.href);
    url.hash = encodeShareState(state);
    window.history.replaceState(window.history.state, "", url);
    return url.toString();
  }, []);

  return { enabled, readInitial, createLink };
}
