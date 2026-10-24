<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="docs/brand/logo-light.svg">
    <img alt="kitforweb" src="docs/brand/logo-light.svg" width="320">
  </picture>
</h1>

Web developer utilities that run **100% in the browser**. Full specification in [`spec.md`](./spec.md).

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000 → redirects to /en, /es, /fr or /pt based on Accept-Language
```

| Script                                                  | What it does                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `npm run build` / `npm start`                           | Production build (SSG) and server                                    |
| `npm run lint` / `npm run typecheck` / `npm run format` | ESLint, strict TypeScript, Prettier                                  |
| `npm test`                                              | Vitest (pure functions in `src/lib/utils`, detectors, i18n messages) |
| `npm run test:e2e`                                      | Playwright against the production build (run `npm run build` first)  |
| `npm run lhci`                                          | Lighthouse CI with the thresholds in `lighthouserc.json`             |

## Structure

```
src/
├── app/[locale]/            IDE layout, Home, [slug] (tools), about, OG images
├── app/sitemap.ts, robots.ts, llms.txt/route.ts, global-not-found.tsx
├── components/layout/       ActivityBar, Explorer, TabBar, StatusBar, CommandPalette, Settings
├── components/shared/       ToolShell, CodeEditor (CodeMirror 6), SplitPane, CopyButton, FileDrop, DonateButton
├── components/tools/<id>/   one folder per tool
├── config/site.ts           name, domain, links, Ko-fi (the only place they are defined)
├── config/tools.ts          tool registry
├── content/<id>/<locale>.mdx  SEO content (exports `faq` for the FAQPage JSON-LD)
├── i18n/                    routing, request and en/es/fr/pt messages
├── lib/utils/               pure functions, no React
└── proxy.ts                 locale redirect, only on "/"
```

## Adding a tool

1. `src/components/tools/<id>/` with a default-exported client component that uses `ToolShell`.
2. Its pure logic in `src/lib/utils/<domain>/` with `*.test.ts` tests.
3. An entry in `src/config/tools.ts` (id, group, icon, per-locale slugs, keywords, `sensitive`, `shareable`, `detects`, `load`).
4. Strings in `src/i18n/messages/*.json` → `tools.<id>` (the i18n test warns about any missing key).
5. SEO content in `src/content/<id>/en.mdx` and `es.mdx`.

The menu, routes, sitemap, llms.txt, search, Ctrl+K and the detector pick it up automatically.

## Brand assets

The sources live in `assets/images/` and are never served directly. `npm run generate:icons` builds everything else from them:

| Output                                                               | Used for                                         |
| -------------------------------------------------------------------- | ------------------------------------------------ |
| `src/app/icon.svg`, `favicon.ico` (16/32/48), `apple-icon.png` (180) | Browser and home-screen icons                    |
| `public/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | PWA manifest; `icon-512.png` is the JSON-LD logo |
| `public/examples/`                                                   | "Load example" in the image tools                |
| `docs/brand/logo-*.svg`, `github-social-preview.png` (1280×640)      | This README and the repository social preview    |

Open Graph and Twitter images are rendered at build time by the `opengraph-image.tsx` routes, using the card layout in `src/lib/og-card.ts`. The in-app wordmark is `src/components/shared/logo.tsx`.

## Configuration

- `NEXT_PUBLIC_SITE_URL`: production origin (defaults to `https://kitforweb.com`, in `src/config/site.ts`).
