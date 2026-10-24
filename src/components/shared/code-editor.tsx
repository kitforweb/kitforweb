"use client";

import dynamic from "next/dynamic";

export interface EditorDiagnostic {
  from: number;
  to: number;
  message: string;
  severity?: "error" | "warning" | "info";
}

export type EditorLanguage =
  "plain" | "json" | "javascript" | "typescript" | "jsx" | "tsx" | "css" | "html" | "xml" | "sql" | "yaml" | "markdown";

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: EditorLanguage;
  readOnly?: boolean;
  diagnostics?: EditorDiagnostic[];
  ariaLabel: string;
  placeholder?: string;
  lineWrapping?: boolean;
  /** Publish cursor position, size and detected type to the status bar. */
  reportStatus?: boolean;
}

function EditorSkeleton() {
  return <div className="h-full animate-pulse bg-editor" aria-hidden />;
}

/** CodeMirror 6 editor shared by every tool. Loaded on demand, client-only. */
export const CodeEditor = dynamic<CodeEditorProps>(() => import("./code-editor-impl"), {
  ssr: false,
  loading: EditorSkeleton,
});
