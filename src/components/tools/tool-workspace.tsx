"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { tools, type ToolId } from "@/config/tools";

function ToolSkeleton() {
  return <div className="h-[60vh] animate-pulse rounded-lg border bg-surface-1 md:h-full" aria-hidden />;
}

// One lazily-loaded, client-only component per tool. Nothing is downloaded
// until a tool is actually rendered.
const components = Object.fromEntries(
  tools.map((tool) => [tool.id, dynamic(tool.load, { ssr: false, loading: ToolSkeleton })]),
) as Record<ToolId, ComponentType>;

/** Interactive part of a tool page. SEO content is rendered by the server around it. */
export function ToolWorkspace({ toolId }: { toolId: ToolId }) {
  const Tool = components[toolId];
  return (
    // Desktop: fills the rest of the page's height (never below 30rem; <main> scrolls if it must).
    <div className="md:min-h-[30rem] md:flex-1" data-testid="tool-workspace">
      <Tool />
    </div>
  );
}
