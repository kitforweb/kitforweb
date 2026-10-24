"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useWorkspace } from "./use-workspace";

type Mermaid = (typeof import("mermaid"))["default"];

let mermaidModule: Promise<Mermaid> | null = null;
/** Mermaid is large: it is downloaded the first time a diagram is rendered. */
const loadMermaid = () => (mermaidModule ??= import("mermaid").then((m) => m.default));

/**
 * Where Mermaid lays out the SVG while measuring it. By default it appends a
 * temporary node to <body>, which stretches the page for a moment and makes it
 * scroll; a fixed, clipped box keeps the layout (needed to measure text)
 * without affecting the document.
 */
function renderSandbox(): HTMLElement {
  const id = "mermaid-sandbox";
  let box = document.getElementById(id);
  if (!box) {
    box = document.createElement("div");
    box.id = id;
    box.setAttribute("aria-hidden", "true");
    box.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:0;overflow:hidden;visibility:hidden";
    document.body.append(box);
  }
  return box;
}

/**
 * Renders Mermaid code to an SVG string, following the site theme. Keeps the
 * last good SVG while the code has an error, so the preview does not flash.
 */
export function useMermaid(code: string): { svg: string; error: string | null } {
  const { theme } = useWorkspace();
  const [state, setState] = useState<{ svg: string; error: string | null }>({ svg: "", error: null });
  const renderId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const counter = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = await loadMermaid();
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: theme === "dark" ? "dark" : "default",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        // Plain SVG text (no foreignObject) so PNG export works everywhere.
        htmlLabels: false,
        flowchart: { htmlLabels: false },
      });
      if (!code.trim()) {
        if (!cancelled) setState({ svg: "", error: null });
        return;
      }
      try {
        await mermaid.parse(code);
        const { svg } = await mermaid.render(`mmd-${renderId}-${++counter.current}`, code, renderSandbox());
        if (!cancelled) setState({ svg, error: null });
      } catch (e) {
        if (!cancelled) setState((s) => ({ svg: s.svg, error: e instanceof Error ? e.message : String(e) }));
        // Mermaid can leave a temporary error node in <body>.
        document.querySelectorAll(`[id^="dmmd-${renderId}"]`).forEach((n) => n.remove());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, theme, renderId]);

  return state;
}
