import type { DataKind } from "@/lib/utils/detect/detectors";

/** What the status bar shows about the editor that has focus. */
export interface EditorStatus {
  line: number;
  column: number;
  chars: number;
  bytes: number;
  kind: DataKind | null;
}

let status: EditorStatus | null = null;
const listeners = new Set<() => void>();

export const statusStore = {
  getSnapshot: (): EditorStatus | null => status,
  getServerSnapshot: (): EditorStatus | null => null,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  set(next: EditorStatus | null): void {
    status = next;
    listeners.forEach((l) => l());
  },
};
