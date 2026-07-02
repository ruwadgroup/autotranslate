---
'@autotranslate/core': minor
'@autotranslate/cli': minor
'@autotranslate/next': minor
'@autotranslate/vite': minor
'@autotranslate/react': minor
'@autotranslate/eslint-plugin': minor
'@autotranslate/typescript-plugin': minor
'@autotranslate/zod': minor
---

The plugin is the product - zero-command DX

## Features

**Save-driven dev loop.** `@autotranslate/cli` exports `createDevLoop` (chokidar
v4 watcher, 150ms debounce, serialized runs). `withAutotranslate` starts it
automatically on `phase-development-server`; `@autotranslate/vite` starts it in
`configureServer`. Developers run no i18n commands — save a file and
translations appear.

**Frozen builds.** `checkFrozen` re-extracts source in memory and compares
against the committed catalog. `withAutotranslate` (Next) and
`@autotranslate/vite` (`buildStart`) throw with a precise list of missing
strings when the check fails. The model is never called at build time; CI needs
no API key. Configure via `build: { frozen, translateOnBuild }` in
`autotranslate.config.ts` or per-plugin options.

**Catalogs as module.** `extract` and `translate` now codegen
`<outDir>/index.ts` — a static-import module with `source`, `locales`, and
`loadCatalog(locale)`. Bundlers code-split per locale; edge runtimes work with
zero configuration. Consumption:
`import * as catalogModule from '../../.translations'` then
`getT(lang, { module: catalogModule })`.

**Auto mode.** Set `mode: 'auto'` in `autotranslate.config.ts` to have the
compiler wrap JSX text nodes in `<T>` at compile time. Opt out with
`data-no-translate`; `code`/`pre`/`script`/`style` are always skipped.
`withAutotranslate` registers `@autotranslate/next/auto-loader` for webpack and
turbopack; `@autotranslate/vite` applies the transform hook. A shared classifier
in `@autotranslate/core/classifier` ensures ESLint, compiler, and extractor
always agree on what counts as translatable text.

**PR parity.** New `autotranslate parity` command diffs catalogs against a base
git ref. `--format github` emits a Markdown table for PR comments; exit code 1
on parity failures. See `docs/cookbook/pr-parity.md` for the GitHub Actions
recipe.

**Editor inlay hints.** `@autotranslate/typescript-plugin` now decorates
`provideInlayHints` to show translated values after every tracked `t('...')`
call (truncated to 40 chars, locale configured via `PluginConfig.locale`).

**`init` overhaul.** `npx autotranslate init` now detects the framework from
`package.json`, AST-edits `next.config.{ts,mjs,js}` with `withAutotranslate`,
creates `proxy.ts`, patches `tsconfig.json` `include`, appends
`.translations/.cache/` to `.gitignore`, and prints the layout diff for
`app/[lang]/layout.tsx`. Flags: `--framework`, `--targets`, `--provider`,
`--force`.

## Breaking changes

**`fsCatalogLoader` removed** from `@autotranslate/next`. Use the generated
`<outDir>/index.ts` module (`{ module: catalogModule }`) or a custom `load`
callback. `GetTOptions.cwd` and `GetTOptions.outDir` are also removed.

**Streaming handlers removed.** `@autotranslate/next/streaming`
(`createStreamingHandler`) and the `streaming` option in `@autotranslate/vite`
are removed. The save-driven dev loop supersedes them.

**`createDevOnMissing`** and `DevOnMissingOptions` removed from
`@autotranslate/react`.

**`migrate-format` CLI command removed.** Stale catalogs regenerate naturally on
the next `extract` / `translate` run.

**Flat `<locale>.json` catalog fallback removed** from `@autotranslate/cli`,
`@autotranslate/next`, `@autotranslate/vite`, and
`@autotranslate/typescript-plugin`. Only the hash-bucketed chunk-tree layout is
supported.

**`migrateKey` / `migrateCatalog` removed** from `@autotranslate/core`. Key
migration is handled by re-running extract.

**`outputFileTracingIncludes` / `traceIncludes` removed** from
`withAutotranslate`. Module-based catalog loading removes the need for runtime
filesystem tracing.

**Dictionary mode removed.** The `dictionary` config field, `useTranslations`
hook (`@autotranslate/react`), and `getTranslations` server helper
(`@autotranslate/next`) are removed. Write inline literal strings with `useT`
and `<T>`; the literal string is both the key and the fallback.

**`hybrid` provider removed.** Use a custom provider to route structured tree
entries to AI and plain strings to DeepL or Google. See
[Custom provider](../docs/cookbook/custom-provider.md) for the hand-rolled
pattern.

**Miss-stats API removed.** `getMissCount`, `getMissBreakdown`, and
`resetMissStats` are removed from `@autotranslate/core`.
