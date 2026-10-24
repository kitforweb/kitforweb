import { Coffee } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { site } from "@/config/site";
import { cn } from "cn";

/** Plain link to Ko-fi: no SDK, no third-party script. */
export async function DonateButton({ className }: { className?: string }) {
  const t = await getTranslations("donate");
  return (
    <a
      href={site.kofi}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-glow transition-shadow hover:shadow-glow-strong",
        className,
      )}
    >
      <Coffee className="size-4" aria-hidden />
      {t("button")}
    </a>
  );
}
