import { toolForKind, type ToolId } from "@/config/tools";
import { resolveDetections, type Resolution } from "@/lib/utils/detect/resolve";

/** Smart detector wired to the tool registry. */
export function detectTools(input: string): Resolution<ToolId> {
  return resolveDetections(input, toolForKind);
}
