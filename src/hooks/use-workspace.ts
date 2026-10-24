"use client";

import { useSyncExternalStore } from "react";
import { workspaceStore, type WorkspaceState } from "@/lib/workspace-store";

export function useWorkspace(): WorkspaceState {
  return useSyncExternalStore(workspaceStore.subscribe, workspaceStore.getSnapshot, workspaceStore.getServerSnapshot);
}
