"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ToolId } from "@/config/tools";
import { useSettled } from "@/hooks/use-settled";
import { useDebounced } from "@/hooks/use-debounced";
import { useToolInput } from "@/hooks/use-tool-input";
import { errorMessage, fail, type ConvertResult } from "@/lib/utils/convert/result";
import { cn } from "cn";
import { CodeEditor, type EditorLanguage } from "./code-editor";
import { FileDrop, FileOpenButton } from "./file-drop";
import { ToolShell } from "./tool-shell";

export interface ConverterSide {
  label: string;
  language?: EditorLanguage;
}

export interface ConverterDirection {
  input: ConverterSide;
  output: ConverterSide;
}

export interface ConverterToolProps {
  toolId: ToolId;
  /** One direction, or two for A ↔ B converters (Swap flips them). */
  directions: [ConverterDirection] | [ConverterDirection, ConverterDirection];
  /** Must be stable (useCallback) or it re-runs on every render. */
  convert: (input: string, direction: number) => ConvertResult | Promise<ConvertResult>;
  example: string | ((direction: number) => string);
  toolbar?: ReactNode | ((direction: number) => ReactNode);
  placeholder?: string;
  fileAccept?: string;
  wrapOutput?: boolean;
  /** Replaces the default read-only editor in the output panel. */
  renderOutput?: (output: string, direction: number) => ReactNode;
  outputActions?: ReactNode;
  /** Extra content under the input editor (options that belong to the input). */
  inputFooter?: ReactNode;
  defaultInputSize?: number;
  debounce?: number;
}

function runSafely(
  convert: ConverterToolProps["convert"],
  input: string,
  direction: number,
): ConvertResult | Promise<ConvertResult> {
  try {
    const r = convert(input, direction);
    return r instanceof Promise ? r.catch((e: unknown) => fail(errorMessage(e))) : r;
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Shared skeleton for every "paste on the left, get it converted on the right" tool. */
export function ConverterTool({
  toolId,
  directions,
  convert,
  example,
  toolbar,
  placeholder,
  fileAccept,
  wrapOutput = false,
  renderOutput,
  outputActions,
  inputFooter,
  defaultInputSize,
  debounce = 200,
}: ConverterToolProps) {
  const tc = useTranslations("common");
  const [input, setInput] = useToolInput(toolId, "");
  const [direction, setDirection] = useState(0);
  const debounced = useDebounced(input, debounce);
  const current = useMemo(
    () => (debounced.trim() ? runSafely(convert, debounced, direction) : null),
    [debounced, direction, convert],
  );
  const { value: result, pending } = useSettled(current);
  const side = directions[direction] ?? directions[0];
  const output = result?.ok ? result.output : "";
  const exampleFor = (d: number) => (typeof example === "function" ? example(d) : example);

  return (
    <ToolShell
      toolId={toolId}
      inputLabel={side.input.label}
      outputLabel={side.output.label}
      defaultInputSize={defaultInputSize}
      onExample={() => setInput(exampleFor(direction))}
      onClear={() => setInput("")}
      onSwap={
        directions.length === 2
          ? () => {
              if (output) setInput(output);
              setDirection((d) => (d === 0 ? 1 : 0));
            }
          : output
            ? () => setInput(output)
            : undefined
      }
      copyText={output}
      toolbar={typeof toolbar === "function" ? toolbar(direction) : toolbar}
      inputActions={<FileOpenButton accept={fileAccept} onText={setInput} />}
      outputActions={outputActions}
      input={
        <div className="flex h-full min-h-0 flex-col">
          <FileDrop onText={setInput} className="min-h-0 flex-1">
            <CodeEditor
              value={input}
              onChange={setInput}
              language={side.input.language}
              ariaLabel={side.input.label}
              placeholder={placeholder}
            />
          </FileDrop>
          {inputFooter}
        </div>
      }
      output={
        <div
          className={cn("flex h-full min-h-0 flex-col transition-opacity", pending && "opacity-60")}
          aria-busy={pending}
        >
          {!debounced.trim() || result === undefined ? (
            <p className="p-4 text-sm text-muted-foreground">{pending ? tc("working") : tc("emptyHint")}</p>
          ) : result === null ? (
            <p className="p-4 text-sm text-muted-foreground">{tc("emptyHint")}</p>
          ) : !result.ok ? (
            <div role="alert" className="flex items-start gap-2 p-4 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="font-mono text-[13px] whitespace-pre-wrap">
                {result.line !== undefined && (
                  <span className="me-2 text-muted-foreground">
                    {tc("position", { line: result.line, column: result.column ?? 1 })}
                  </span>
                )}
                {result.error}
              </p>
            </div>
          ) : (
            <>
              {result.notes && result.notes.length > 0 && (
                <p role="status" className="shrink-0 border-b px-3 py-1.5 font-mono text-xs text-muted-foreground">
                  {result.notes.join(" · ")}
                </p>
              )}
              {result.warnings && result.warnings.length > 0 && (
                <ul
                  className="shrink-0 space-y-1 border-b bg-warning/10 px-3 py-2 text-xs text-warning"
                  data-testid="converter-warnings"
                >
                  {result.warnings.map((w) => (
                    <li key={w} className="flex items-start gap-2">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
              <div className="min-h-0 flex-1" data-testid="converter-output">
                {renderOutput ? (
                  renderOutput(result.output, direction)
                ) : (
                  <CodeEditor
                    value={result.output}
                    language={side.output.language}
                    readOnly
                    lineWrapping={wrapOutput}
                    ariaLabel={side.output.label}
                    reportStatus={false}
                  />
                )}
              </div>
            </>
          )}
        </div>
      }
    />
  );
}
