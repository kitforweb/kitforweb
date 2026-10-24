"use client";

import type { ReactNode } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useIsDesktop } from "@/hooks/use-media-query";

interface SplitPaneProps {
  start: ReactNode;
  end: ReactNode;
  /** Initial size of the first panel, in percent. */
  defaultStart?: number;
}

/** Two resizable panels side by side; stacked on small screens. */
export function SplitPane({ start, end, defaultStart = 50 }: SplitPaneProps) {
  const desktop = useIsDesktop();
  if (!desktop) {
    return (
      <div className="flex flex-col gap-px bg-border">
        <div className="h-[55vh] min-h-72 bg-background">{start}</div>
        <div className="h-[55vh] min-h-72 bg-background">{end}</div>
      </div>
    );
  }
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={`${defaultStart}`} minSize="20">
        {start}
      </ResizablePanel>
      <ResizableHandle withHandle className="hover:bg-primary/60 focus-visible:bg-primary" />
      <ResizablePanel defaultSize={`${100 - defaultStart}`} minSize="20">
        {end}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
