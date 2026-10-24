import type { ToolId } from "@/config/tools";

/**
 * In-memory hand-off of pasted content from the smart detector to a tool.
 * Content never travels through the URL (it may be a token or a secret).
 */
const pending = new Map<ToolId, string>();

export const handoff = {
  put(toolId: ToolId, content: string): void {
    pending.set(toolId, content);
  },
  /** Pending content for a tool. Pure, so it is safe in state initialisers. */
  peek(toolId: ToolId): string | undefined {
    return pending.get(toolId);
  },
  clear(toolId: ToolId): void {
    pending.delete(toolId);
  },
};
