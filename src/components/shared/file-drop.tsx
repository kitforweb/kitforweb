"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

interface FileDropProps {
  onText: (text: string, file: File) => void;
  children: ReactNode;
  className?: string;
}

/** Drop zone around `children` that reads a file locally as text. */
export function FileDrop({ onText, children, className }: FileDropProps) {
  const [over, setOver] = useState(false);

  const read = async (file: File | undefined) => {
    if (file) onText(await file.text(), file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void read(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={cn("relative h-full", className)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      {children}
      {over && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center border-2 border-dashed border-primary bg-background/80">
          <Upload className="size-8 text-primary" aria-hidden />
        </div>
      )}
    </div>
  );
}

/** Small "open file" button that reads the file locally as text. */
export function FileOpenButton({ onText, accept }: { onText: (text: string, file: File) => void; accept?: string }) {
  const t = useTranslations("common");
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => input.current?.click()} aria-label={t("openFile")}>
        <Upload />
        <span className="hidden lg:inline">{t("openFile")}</span>
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onText(await file.text(), file);
          e.target.value = "";
        }}
      />
    </>
  );
}
