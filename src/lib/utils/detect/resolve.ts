import { detectAll, type DataKind } from "./detectors";

export interface Detection<Id extends string = string> {
  toolId: Id;
  kind: DataKind;
  confidence: number; // 0..1
}

export interface Resolution<Id extends string = string> {
  /** Set when one tool is clearly the right one: navigate straight to it. */
  auto: Detection<Id> | null;
  /** Every tool that could handle the input, best first (shown as chips). */
  candidates: Detection<Id>[];
}

export const AUTO_THRESHOLD = 0.85;
const RIVAL_THRESHOLD = 0.5;
/** A rival this far below the best candidate does not block auto-navigation. */
const CLEAR_MARGIN = 0.2;

/**
 * Maps detected kinds onto the tools that handle them. `toolForKind` comes
 * from the tool registry, so new tools are picked up without touching this.
 */
export function resolveDetections<Id extends string>(
  input: string,
  toolForKind: (kind: DataKind) => Id | undefined,
): Resolution<Id> {
  const candidates: Detection<Id>[] = [];
  for (const d of detectAll(input)) {
    const toolId = toolForKind(d.kind);
    if (toolId && !candidates.some((c) => c.toolId === toolId)) {
      candidates.push({ toolId, kind: d.kind, confidence: d.confidence });
    }
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  const [first, second] = candidates;
  const auto =
    first &&
    first.confidence >= AUTO_THRESHOLD &&
    (!second || second.confidence < RIVAL_THRESHOLD || first.confidence - second.confidence >= CLEAR_MARGIN)
      ? first
      : null;
  return { auto, candidates };
}
