---
'@autotranslate/next': minor
---

Initial implementation of `@autotranslate/next`, targeting Next.js 16+.

- **`@autotranslate/next`** server entry exposes `getT(locale, options?)` (async
  translator factory with a default fs-backed catalog loader and `fallback`
  source-locale support), `getRequestLocale()` (reads the
  `x-autotranslate-locale` header set by the proxy), and
  `fsCatalogLoader(cwd, outDir)` for callers that want to compose the default
  loader. The fs loader memoizes per `(cwd, outDir, locale)` tuple;
  `clearCatalogCache()` drops the cache for tests / HMR.
- **`@autotranslate/next/middleware`** ships `createNextMiddleware(options)` — a
  `proxy`-compatible function (Next 16 renamed `middleware` → `proxy`)
  supporting both `'prefix'` (default, redirects bare paths to `/<locale>/...`
  and strips the default-locale prefix unless `prefixDefaultLocale: true`) and
  `'cookie'` strategies (`NEXT_LOCALE` cookie by default; configurable). In both
  modes the resolved locale is pushed downstream via the
  `x-autotranslate-locale` header so server components can read it via
  `getRequestLocale()`.
- **`@autotranslate/next/plugin`** ships `withAutotranslate(config)` — a typed
  pass-through today that exists as the canonical integration point for future
  build-time hooks (typegen on `next build`, catalog inlining, dev-mode HMR).
- 16 tests across `middleware.test.ts`, `catalog-loader.test.ts`, and
  `index.test.ts`.
