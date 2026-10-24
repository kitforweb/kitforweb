"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { convertColor } from "@/lib/utils/css/color";
import { cn } from "cn";

/**
 * Any CSS color as text, with the native picker as a shortcut. The picker only
 * speaks hex, so it shows (and writes) the hex of whatever the text holds.
 */
export function ColorField({
  label,
  value,
  onChange,
  className,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  hideLabel?: boolean;
}) {
  const id = useId();
  const parsed = convertColor(value);
  const hex = parsed.ok ? parsed.formats.hex.slice(0, 7) : "#000000";
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id} className={cn("text-xs text-muted-foreground", hideLabel && "sr-only")}>
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} (picker)`}
          className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-invalid={!parsed.ok}
          className="font-mono"
        />
      </div>
    </div>
  );
}
