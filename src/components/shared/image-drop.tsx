"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { ImageUp } from "lucide-react";
import { cn } from "cn";

/** Drop zone + file picker for binary files (images). Nothing is uploaded: the File stays in the page. */
export function ImageDrop({
  onFile,
  accept = "image/*",
  label,
  hint,
  multiple = false,
  className,
  children,
}: {
  onFile: (files: File[]) => void;
  accept?: string;
  label: string;
  hint?: string;
  multiple?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (files.length > 0) onFile(multiple ? files : files.slice(0, 1));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files);
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
        over ? "border-primary bg-primary/5" : "border-border",
        className,
      )}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      {children ?? <ImageUp className="size-8 text-muted-foreground" aria-hidden />}
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="text-sm font-medium text-accent-text underline underline-offset-4"
      >
        {label}
      </button>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        data-testid="image-input"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
