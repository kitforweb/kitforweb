import type { Metadata } from "next";
import { site } from "@/config/site";
import { defaultLocale } from "@/i18n/routing";
import "./globals.css";

export const metadata: Metadata = {
  title: `404 · ${site.name}`,
  robots: { index: false },
};

/** Unmatched URLs outside any locale (the root layout lives in /[locale]). */
export default function GlobalNotFound() {
  return (
    <html lang="en" className="dark">
      <body className="grid min-h-dvh place-items-center bg-background p-6 text-center text-foreground">
        <div>
          <p className="font-mono text-sm text-primary">404</p>
          <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
          <a href={`/${defaultLocale}`} className="mt-6 inline-block text-primary underline underline-offset-4">
            {site.name}
          </a>
        </div>
      </body>
    </html>
  );
}
