"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  text: string | (() => string);
  label?: string;
  variant?: "default" | "ghost" | "outline" | "secondary";
  size?: "sm" | "default" | "icon-sm";
  disabled?: boolean;
}

export function CopyButton({ text, label, variant = "ghost", size = "sm", disabled }: CopyButtonProps) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
      setCopied(true);
    } catch {
      // Clipboard denied: nothing to do, the text is still selectable.
    }
  };

  const content = label ?? t("copy");
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={copy}
      disabled={disabled}
      aria-label={size === "icon-sm" ? content : undefined}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
      {size !== "icon-sm" && <span>{copied ? t("copied") : content}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? t("copied") : ""}
      </span>
    </Button>
  );
}
