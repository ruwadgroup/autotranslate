# Roadmap

Public, intentionally narrow. Expect cuts and reorders — file an issue if a
milestone matters to you.

## v0.1 — Core extractor + React runtime

- [x] `@autotranslate/core` — config schema (Zod), `defineConfig`, locale
      resolver, ICU parser, hashing
- [x] `@autotranslate/cli` — `init`, `extract`, `translate`, `check`
- [x] `@autotranslate/providers` — `stub`, `ai` (Anthropic, OpenAI, Google,
      OpenRouter)
- [x] `@autotranslate/react` — `<T>`, `<Var>`, `<Plural>`, `<Branch>`, `useT`,
      `<TranslationProvider>`
- [x] `examples/vite-react` end-to-end
- [x] CI green on Linux / macOS / Windows × Node 20 / 22

## v0.2 — Next.js + RSC

- [x] `@autotranslate/next` — `withAutotranslate`, `createNextMiddleware`,
      `getT`, `getTranslations`
- [x] App Router catalog loading (memoized per request)
- [x] `examples/next-app` end-to-end
- [x] Locale routing — prefix and cookie strategies

## v0.3 — Vite plugin + virtual modules

- [x] `@autotranslate/vite` — virtual locale modules + HMR
- [x] Build-time catalog inlining

## v0.4 — Type generation + ESLint plugin

- [x] `autotranslate generate-types`
- [x] `@autotranslate/eslint-plugin` — `no-untranslated-jsx`, `no-dynamic-key`,
      `valid-icu-format`

## v0.5 — More providers

- [x] `@autotranslate/providers/deepl`
- [x] `@autotranslate/providers/google`
- [x] Hybrid mode — AI for structured tree entries, MT for plain strings

## v0.6 — Standalone `t()` + Zod integration

- [x] `@autotranslate/core/standalone` — `bindTranslator`, `withTranslator`,
      `currentTranslator`, sync `t()`
- [x] `@autotranslate/zod` — Zod v4 error map, Next + Remix adapters
- [x] Cookbook (locale switcher, form validation, server actions, testing,
      lazy-loading, custom provider, debugging, …)

## v0.7 — Glossary + hybrid provider

- [x] Glossary support (branded terms the AI must never translate)
- [x] `@autotranslate/typescript-plugin` — editor diagnostics for unknown keys

## v1.0-beta — The plugin is the product

This release ships the zero-command DX the philosophy always promised.

### Shipped

- [x] **Save-driven dev loop** (`createDevLoop` in `@autotranslate/cli`) -
      replaces streaming dev-mode translation. `withAutotranslate` and
      `@autotranslate/vite` start it automatically in dev; save a file,
      translations appear.
- [x] **Frozen builds** (`checkFrozen`) — production builds re-extract in memory
      and fail with a precise list when strings are uncommitted. CI needs no API
      key. Opt out with `build: { frozen: false }` or translate in-place with
      `build: { translateOnBuild: true }`.
- [x] **Catalogs as module** (`<outDir>/index.ts`) — `extract` and `translate`
      codegen a static-import module; bundlers code-split per locale, edge
      runtimes work with zero config. `fsCatalogLoader` removed.
- [x] **Auto mode** (`mode: 'auto'`) — compiler wraps JSX text in `<T>` at
      compile time; opt out with `data-no-translate`; shared classifier ensures
      ESLint, compiler, and extractor always agree.
- [x] **PR parity** (`autotranslate parity`) — diff catalogs against a git ref,
      emit a Markdown table for GitHub PR comments.
- [x] **Editor inlay hints** (`@autotranslate/typescript-plugin`) — shows
      translated values inline after every `t('...')` call.
- [x] **`init` overhaul** — `npx autotranslate init` detects the framework,
      AST-edits `next.config.ts`, creates `proxy.ts`, patches `tsconfig.json`
      and `.gitignore`, and prints the layout diff; idempotent.
- [x] `catalog.chunkBits` config field (0-12, default 4) — was wired in code but
      not exposed via config.

### Removals (breaking)

- Streaming dev-mode handlers (`@autotranslate/next/streaming`,
  `@autotranslate/vite` `streaming` option) — superseded by the dev loop.
- `createDevOnMissing` from `@autotranslate/react` — same reason.
- `migrate-format` CLI command — stale catalogs regenerate naturally on next
  extract/translate run.
- Flat `<locale>.json` catalog fallback — chunk-tree layout is the only
  supported format.
- `migrateKey` / `migrateCatalog` from `@autotranslate/core` — key migration is
  handled by re-running extract.
- `fsCatalogLoader`, `extraRoots`, `GetTOptions.cwd/outDir` from
  `@autotranslate/next` — replaced by the generated module.
- `outputFileTracingIncludes` merge and `traceIncludes` option in
  `withAutotranslate` — not needed with module-based loading.

## Beyond v1

- Vue, Svelte, Solid adapters
- React Native / Expo first-class
- Edge KV catalog backend
- AI-driven glossary inference
- Attribute auto-wrapping (`placeholder`, `aria-label`, …)
- Back-translation column in parity reports
