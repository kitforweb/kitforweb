"use client";

import { useRef, type ComponentProps } from "react";
import { Download, ListTree } from "lucide-react";
import { useTranslations } from "next-intl";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { CodeEditor } from "@/components/shared/code-editor";
import { CopyButton } from "@/components/shared/copy-button";
import { FileDrop, FileOpenButton } from "@/components/shared/file-drop";
import { ToolShell } from "@/components/shared/tool-shell";
import { Button } from "@/components/ui/button";
import { useDebounced } from "@/hooks/use-debounced";
import { useMermaid } from "@/hooks/use-mermaid";
import { useToolInput } from "@/hooks/use-tool-input";
import { downloadBlob } from "@/lib/download";
import { extractHeadings, htmlDocument, markdownStats, tableOfContents } from "@/lib/utils/text/markdown";

const EXAMPLE = `# kitforweb

Developer tools that run **100% in your browser**.

## Features

- [x] JSON, JWT and regex tools
- [x] Smart detection on the home page
- [ ] Plugins

| Tool | Group | Status |
| --- | --- | :---: |
| JSON Formatter | JSON | ✅ |
| Markdown | Text | ✅ |

## Usage

\`\`\`ts
import { format } from "kitforweb";

const pretty = format('{"a":1}', { indent: 2 });
\`\`\`

## Architecture

\`\`\`mermaid
flowchart LR
  Input --> Detector --> Tool
\`\`\`

> Nothing you paste leaves your device.
`;

// Keep the language class on code blocks so highlighting and Mermaid still work after sanitizing.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-/]],
  },
};

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
};

const textOf = (node: HastNode | undefined): string =>
  !node ? "" : node.type === "text" ? (node.value ?? "") : (node.children ?? []).map(textOf).join("");

function MermaidBlock({ code }: { code: string }) {
  const { svg, error } = useMermaid(code);
  if (error && !svg) return <pre className="text-destructive">{error}</pre>;
  return (
    <div
      className="my-4 flex justify-center [&_svg]:max-w-full"
      data-testid="md-mermaid"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const components: Components = {
  pre({ node, ...props }: ComponentProps<"pre"> & { node?: HastNode }) {
    const code = node?.children?.[0];
    const classes = code?.properties?.className;
    if (Array.isArray(classes) && classes.includes("language-mermaid")) return <MermaidBlock code={textOf(code)} />;
    return <pre {...props} />;
  },
};

export default function MarkdownTool() {
  const t = useTranslations("tools.markdown");
  const [text, setText] = useToolInput("markdown", "");
  const debounced = useDebounced(text, 150);
  const previewRef = useRef<HTMLDivElement>(null);
  const stats = markdownStats(debounced);
  const headings = extractHeadings(debounced);
  const title = headings[0]?.text ?? "document";

  const html = () => previewRef.current?.innerHTML ?? "";

  return (
    <ToolShell
      toolId="markdown"
      inputLabel="README.md"
      outputLabel={t("preview")}
      onExample={() => setText(EXAMPLE)}
      onClear={() => setText("")}
      copyText={html}
      inputActions={
        <>
          <CopyButton
            text={() => tableOfContents(extractHeadings(text))}
            label={t("copyToc")}
            disabled={headings.length < 2}
          />
          <FileOpenButton accept=".md,.markdown,text/markdown,text/plain" onText={setText} />
        </>
      }
      outputActions={
        <>
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline" data-testid="md-stats">
            {t("stats", { words: stats.words, minutes: stats.readingMinutes })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={!debounced.trim()}
            onClick={() =>
              downloadBlob(
                new Blob([htmlDocument(html(), title)], { type: "text/html" }),
                `${title.toLowerCase().replace(/\W+/g, "-") || "document"}.html`,
              )
            }
          >
            <Download />
            HTML
          </Button>
        </>
      }
      input={
        <FileDrop onText={setText}>
          <CodeEditor
            value={text}
            onChange={setText}
            language="markdown"
            ariaLabel="Markdown"
            placeholder={t("placeholder")}
          />
        </FileDrop>
      }
      output={
        debounced.trim() ? (
          <div className="h-full overflow-auto">
            <div
              ref={previewRef}
              className="prose-tool markdown-preview mx-auto max-w-3xl p-6"
              data-testid="md-preview"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[
                  [rehypeSanitize, schema],
                  [rehypeHighlight, { plainText: ["mermaid"] }],
                ]}
                components={components}
              >
                {debounced}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <ListTree className="size-4" aria-hidden />
            {t("hint")}
          </p>
        )
      }
    />
  );
}
