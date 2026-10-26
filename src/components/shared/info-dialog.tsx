"use client";

import { useId, useRef, type ReactNode } from "react";
import { BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Button + native <dialog> for long-form content. `children` is rendered by the
 * server, so it is in the HTML (and indexed) even while the dialog is closed.
 * Radix Dialog would not work here: it mounts its content only when opened.
 */
export function InfoDialog({
  label,
  title,
  closeLabel,
  children,
}: {
  label: string;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 self-start text-accent-text md:self-auto"
        onClick={() => dialog.current?.showModal()}
      >
        <BookOpen />
        {label}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        // A click on the dialog element itself (not its content) is a click on the backdrop.
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-auto max-h-[85dvh] w-[min(48rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-surface-1 px-5 py-3">
          <h2 id={titleId} className="font-heading text-base font-semibold">
            {title}
          </h2>
          <form method="dialog">
            <Button type="submit" variant="ghost" size="icon-sm" aria-label={closeLabel}>
              <X />
            </Button>
          </form>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pb-8 md:px-8">{children}</div>
      </dialog>
    </>
  );
}
