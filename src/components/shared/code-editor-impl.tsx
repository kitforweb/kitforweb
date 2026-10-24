"use client";

import { useEffect, useRef } from "react";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { statusStore } from "@/lib/status-store";
import { detectKind } from "@/lib/utils/detect/detectors";
import { utf8Length } from "@/lib/utils/format/bytes";
import type { CodeEditorProps, EditorDiagnostic } from "./code-editor";

const theme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    backgroundColor: "var(--editor)",
    color: "var(--foreground)",
  },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-content": { caretColor: "var(--primary)", paddingBlock: "8px" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--primary)", borderLeftWidth: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklch, var(--primary) 25%, transparent) !important",
  },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklch, var(--foreground) 4%, transparent)" },
  ".cm-gutters": {
    backgroundColor: "var(--editor)",
    color: "var(--muted-foreground)",
    border: "none",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--foreground)" },
  ".cm-foldGutter .cm-gutterElement": { cursor: "pointer" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  ".cm-matchingBracket": {
    backgroundColor: "color-mix(in oklch, var(--primary) 20%, transparent)",
    outline: "1px solid color-mix(in oklch, var(--primary) 50%, transparent)",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--destructive)",
    textUnderlineOffset: "3px",
  },
  ".cm-lintRange-warning": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--warning)",
    textUnderlineOffset: "3px",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
  },
  ".cm-diagnostic": { fontFamily: "var(--font-sans)", fontSize: "12px", padding: "4px 8px" },
  ".cm-diagnostic-error": { borderLeftColor: "var(--destructive)" },
  ".cm-panels": { backgroundColor: "var(--surface-1)", color: "var(--foreground)" },
});

const highlight = HighlightStyle.define([
  { tag: [t.propertyName, t.attributeName, t.typeName, t.className], color: "var(--syntax-key)" },
  { tag: [t.tagName, t.heading, t.definition(t.variableName)], color: "var(--syntax-keyword)", fontWeight: "600" },
  { tag: [t.link, t.url], color: "var(--syntax-string)", textDecoration: "underline" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.string, color: "var(--syntax-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--syntax-number)" },
  { tag: [t.keyword, t.operator], color: "var(--syntax-keyword)" },
  { tag: t.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: [t.brace, t.squareBracket, t.punctuation], color: "var(--muted-foreground)" },
]);

type Language = NonNullable<CodeEditorProps["language"]>;

// Grammars other than JSON download on demand, the first time they are needed.
const loaders: Record<Language, () => Extension | Promise<Extension>> = {
  plain: () => [],
  json: () => json(),
  javascript: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  typescript: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  jsx: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  tsx: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true, typescript: true })),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  xml: () => import("@codemirror/lang-xml").then((m) => m.xml()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
  yaml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
};

async function languageExtension(language: Language): Promise<Extension> {
  try {
    return await loaders[language]();
  } catch {
    return [];
  }
}

function toCmDiagnostics(list: EditorDiagnostic[] | undefined, docLength: number): Diagnostic[] {
  return (list ?? []).map((d) => {
    const from = Math.min(Math.max(0, d.from), docLength);
    const to = Math.min(Math.max(from, d.to), docLength);
    return { from, to, message: d.message, severity: d.severity ?? "error" };
  });
}

export default function CodeEditorImpl({
  value,
  onChange,
  language = "plain",
  readOnly = false,
  diagnostics,
  ariaLabel,
  placeholder,
  lineWrapping = false,
  reportStatus = true,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const statusTimer = useRef<number | undefined>(undefined);
  const compartments = useRef({
    language: new Compartment(),
    readOnly: new Compartment(),
    wrap: new Compartment(),
  });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Create the editor once.
  useEffect(() => {
    if (!host.current) return;
    const c = compartments.current;

    const publishStatus = (v: EditorView) => {
      window.clearTimeout(statusTimer.current);
      statusTimer.current = window.setTimeout(() => {
        const doc = v.state.doc;
        const head = v.state.selection.main.head;
        const line = doc.lineAt(head);
        const text = doc.toString();
        statusStore.set({
          line: line.number,
          column: head - line.from + 1,
          chars: doc.length,
          bytes: utf8Length(text),
          kind: text.length < 200_000 ? (detectKind(text)?.kind ?? null) : null,
        });
      }, 120);
    };

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        foldGutter(),
        lintGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        syntaxHighlighting(highlight),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          indentWithTab,
        ]),
        theme,
        placeholder ? placeholderExt(placeholder) : [],
        EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
        c.language.of([]),
        c.readOnly.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
        c.wrap.of(lineWrapping ? EditorView.lineWrapping : []),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
          if (reportStatus && u.view.hasFocus && (u.docChanged || u.selectionSet || u.focusChanged)) {
            publishStatus(u.view);
          }
        }),
      ],
    });
    view.current = new EditorView({ state, parent: host.current });
    return () => {
      window.clearTimeout(statusTimer.current);
      view.current?.destroy();
      view.current = null;
    };
    // The editor is created once; later prop changes go through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (load example, clear, swap…).
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    void languageExtension(language).then((ext) => {
      if (!cancelled) view.current?.dispatch({ effects: compartments.current.language.reconfigure(ext) });
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.readOnly.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.wrap.reconfigure(lineWrapping ? EditorView.lineWrapping : []),
    });
  }, [lineWrapping]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    v.dispatch(setDiagnostics(v.state, toCmDiagnostics(diagnostics, v.state.doc.length)));
  }, [diagnostics, value]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" data-testid="code-editor" />;
}
