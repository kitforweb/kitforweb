"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/routing";
import { useAppLocale } from "@/hooks/use-app-locale";
import { switchLocalePath } from "@/lib/routes";
import { cn } from "cn";

/** Remembers the explicit choice so "/" redirects there next time. */
export function rememberLocale(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/** Links to the equivalent page in every other language. */
export function LocaleLinks({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const current = useAppLocale();
  return (
    <ul className={cn("grid gap-1", className)}>
      {locales.map((l) => (
        <li key={l}>
          <Link
            href={switchLocalePath(pathname, l)}
            hrefLang={l}
            lang={l}
            aria-current={l === current ? "true" : undefined}
            onClick={() => {
              rememberLocale(l);
              onNavigate?.();
            }}
            className={cn(
              "flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-surface-3",
              l === current && "text-primary",
            )}
          >
            {localeNames[l]}
            <span className="font-mono text-xs text-muted-foreground uppercase">{l}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
