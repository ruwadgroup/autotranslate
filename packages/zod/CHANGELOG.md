# @autotranslate/zod

## 1.0.0-beta.9

### Patch Changes

- Updated dependencies
  [[`e0aa5ca`](https://github.com/ruwadgroup/autotranslate/commit/e0aa5caf41ed90a73939432c5f88c0c5b01adbc3)]:
  - @autotranslate/core@1.0.0-beta.9

## 1.0.0-beta.8

### Patch Changes

- Updated dependencies
  [[`d90aae1`](https://github.com/ruwadgroup/autotranslate/commit/d90aae11c14d9bfb9fb0f93cf0eff82701bfb0de)]:
  - @autotranslate/core@1.0.0-beta.8

## 1.0.0-beta.7

### Patch Changes

- Updated dependencies
  [[`7d3d2d4`](https://github.com/ruwadgroup/autotranslate/commit/7d3d2d40eac596a76d1a80181ef614a3ff49b89e)]:
  - @autotranslate/core@1.0.0-beta.7

## 1.0.0-beta.6

### Patch Changes

- Updated dependencies
  [[`bd0c24a`](https://github.com/ruwadgroup/autotranslate/commit/bd0c24ae45f826f0d07b5bca48f4900f27c73ac0)]:
  - @autotranslate/core@1.0.0-beta.6

## 1.0.0-beta.5

### Patch Changes

- Updated dependencies []:
  - @autotranslate/core@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- Fix package manifests so pnpm consumers receive installable versioned
  dependencies instead of leaked workspace references. Render translated void
  HTML elements such as `<br />` without invalid React children.
- Updated dependencies []:
  - @autotranslate/core@1.0.0-beta.4

## 1.0.0-beta.3

### Minor Changes

- [`fdbf0fc`](https://github.com/ruwadgroup/autotranslate/commit/fdbf0fc680ff666546254560f5ca851b310c1b6d)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - The plugin is the
  product - zero-command DX

  ## Features

  **Save-driven dev loop.** `@autotranslate/cli` exports `createDevLoop`
  (chokidar v4 watcher, 150ms debounce, serialized runs). `withAutotranslate`
  starts it automatically on `phase-development-server`; `@autotranslate/vite`
  starts it in `configureServer`. Developers run no i18n commands — save a file
  and translations appear.

  **Frozen builds.** `checkFrozen` re-extracts source in memory and compares
  against the committed catalog. `withAutotranslate` (Next) and
  `@autotranslate/vite` (`buildStart`) throw with a precise list of missing
  strings when the check fails. The model is never called at build time; CI
  needs no API key. Configure via `build: { frozen, translateOnBuild }` in
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
  `withAutotranslate` registers `@autotranslate/next/auto-loader` for webpack
  and turbopack; `@autotranslate/vite` applies the transform hook. A shared
  classifier in `@autotranslate/core/classifier` ensures ESLint, compiler, and
  extractor always agree on what counts as translatable text.

  **PR parity.** New `autotranslate parity` command diffs catalogs against a
  base git ref. `--format github` emits a Markdown table for PR comments; exit
  code 1 on parity failures. See `docs/cookbook/pr-parity.md` for the GitHub
  Actions recipe.

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

  **`migrate-format` CLI command removed.** Stale catalogs regenerate naturally
  on the next `extract` / `translate` run.

  **Flat `<locale>.json` catalog fallback removed** from `@autotranslate/cli`,
  `@autotranslate/next`, `@autotranslate/vite`, and
  `@autotranslate/typescript-plugin`. Only the hash-bucketed chunk-tree layout
  is supported.

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

### Patch Changes

- [`8e63cf9`](https://github.com/ruwadgroup/autotranslate/commit/8e63cf913189c056a82a3c30ee91f26ebfc86011)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Harden package
  metadata and release verification for ESM and CommonJS consumers. Conditional
  exports now resolve `.d.ts` declarations for ESM and `.d.cts` declarations for
  CommonJS without an ambiguous outer `types` condition. The ESLint plugin no
  longer crashes when loaded through `require()`. Every release now passes
  strict package linting and runtime entry-point smoke tests before publication.
  Vite auto mode now transforms JSX before framework plugins compile it, so
  plain JSX is translated regardless of plugin order.
- Updated dependencies
  [[`fdbf0fc`](https://github.com/ruwadgroup/autotranslate/commit/fdbf0fc680ff666546254560f5ca851b310c1b6d),
  [`8e63cf9`](https://github.com/ruwadgroup/autotranslate/commit/8e63cf913189c056a82a3c30ee91f26ebfc86011)]:
  - @autotranslate/core@1.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- [#78](https://github.com/tamimbinhakim/autotranslate/pull/78)
  [`859ad45`](https://github.com/tamimbinhakim/autotranslate/commit/859ad459ffc3f4a20d51a6df003d94967a959fa4)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Hash-bucketed
  catalog layout — flat per locale, deduped by construction

  Replaces the source-tree-mirroring chunk layout with a flat hash-bucketed
  shape.

  **Before** (chunked by source path — deeply nested, awkward to grep / diff):

  ```
  .translations/
    en/
      apps/web/src/components/Button.json
      apps/web/src/components/Header.json
      packages/ui/src/Card.json
      ...
  ```

  **After** (16 buckets per locale, name = first hex digit of the key's hash):

  ```
  .translations/
    en/
      0.json   1.json   ...   f.json
    es/
      0.json   1.json   ...   f.json
    .meta.json
  ```

  ### What changes for users
  - **Catalog keys are 12-char SHA-256 hashes** (`041c03cfcadc`) instead of
    literal source strings. Plain-string `useT('Sign out')` calls hash
    internally; users still write the literal source. `<T>` blocks already used
    `t.<hash>` keys — those persist with the same shape.
  - **Same hash → same bucket across every locale.** `en/3.json`, `es/3.json`,
    `fr/3.json` carry the same key set, just with different translated values.
  - **Cross-locale alignment is structural.** No drift between locales when keys
    move; the hash is content-addressed.
  - **Smaller, finer-grained diffs.** Adding or changing one string touches one
    bucket file per locale.
  - **Bundler tree-shaking improves.** Each bucket is an independent JSON
    import; SPAs ship only buckets a route actually touches.

  ### Auto-migration on read

  Runtime loaders (`fsCatalogLoader`, Vite virtual module) and the CLI catalog
  reader transparently rekey old literal-keyed catalogs into the new hashed
  layout on first read. Existing apps Just Work after upgrade — the next
  `extract` / `translate` run reshapes the on-disk files.

  ### New CLI command

  ```bash
  npx autotranslate migrate-format
  ```

  Forces every locale through the writer. Useful when you want to migrate
  without running `translate` (e.g., in a one-shot CI codemod). Drops the legacy
  provider cache as part of the run.

  ### New public API
  - `sourceKey(literal, context?)` — produce the catalog storage key for a given
    source string. Stable, deterministic.
  - `buildCatalog(entries)` — convenience for hand-rolled catalogs (tests,
    programmatic overrides). Hashes literal keys, passes `t.*` tree keys
    through.

  ### `chunkBits` config

  ```ts
  defineConfig({
    // ...
    catalog: {
      chunkBits: 4, // default — 16 buckets. Range 0..12.
    },
  });
  ```

  | `chunkBits` | Buckets              | When to pick                                    |
  | ----------- | -------------------- | ----------------------------------------------- |
  | `0`         | 1 (single flat file) | tiny apps (<100 strings), simplest mental model |
  | `4`         | 16                   | **default** — 100 to ~10k strings               |
  | `8`         | 256                  | very large catalogs                             |
  | `12`        | 4096                 | enterprise scale, massive lazy-load surface     |

  ### Performance trade-off

  Translator hot path adds one SHA-256 of the literal key per `t()` call:
  roughly 1.1µs/call (was 0.4µs). Still ~50× under the published <50µs/call
  target. Catalog gzipped size is unchanged at the bench.

- Updated dependencies
  [[`859ad45`](https://github.com/tamimbinhakim/autotranslate/commit/859ad459ffc3f4a20d51a6df003d94967a959fa4)]:
  - @autotranslate/core@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- [#76](https://github.com/tamimbinhakim/autotranslate/pull/76)
  [`8d2a506`](https://github.com/tamimbinhakim/autotranslate/commit/8d2a5060cb8d1f4c9b61b46dc638460206930efd)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Fix subpath type
  resolution under legacy `moduleResolution`

  Reported:
  `Cannot find module '@autotranslate/core/config' or its corresponding type declarations.ts(2307)`
  when consuming the package from a TypeScript project with
  `moduleResolution: 'node10'` (the older default).

  **Root cause.** Subpath exports (`@autotranslate/core/config`,
  `@autotranslate/react/server`, etc.) declared their types via the `exports`
  field only. Modern resolvers (`bundler` / `node16` / `nodenext`) read this
  field; legacy `node10` does not, so the types were unresolvable on older
  tsconfigs.

  **Fixes applied to every public package:**
  1. **Nest `types` per condition.** Each subpath now provides explicit
     `import.types` (→ `.d.ts`) and `require.types` (→ `.d.cts`) so consumers
     resolve the correct declaration shape for their module system.
  2. **Add `typesVersions`** mapping each subpath to its `.d.ts` for legacy
     `node10` resolvers. This is the documented compat path.

  After this release, all subpath imports resolve cleanly under `node10`,
  `node16`, `nodenext`, and `bundler` resolution. Verified with
  `@arethetypeswrong/cli`.

  No runtime change. Patch-level bump.

- Updated dependencies
  [[`8d2a506`](https://github.com/tamimbinhakim/autotranslate/commit/8d2a5060cb8d1f4c9b61b46dc638460206930efd)]:
  - @autotranslate/core@1.0.0-beta.1

## 1.0.0-beta.0

### Major Changes

- [#75](https://github.com/tamimbinhakim/autotranslate/pull/75)
  [`75ba96c`](https://github.com/tamimbinhakim/autotranslate/commit/75ba96cfa7180524fae55b8c973c1fad51c9cd90)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - `autotranslate`
  1.0.0-beta — public API freeze candidate

  The surface is stable enough to call. This release is published under the
  `beta` npm dist-tag (`pnpm add @autotranslate/core@beta`) and exists to soak
  the API in real apps before the GA cut.

  What landed since 0.2:
  - Chunked translation catalogs and per-chunk caching
  - Per-chunk AI context-prefix for consistency across long documents
  - Glossary support + first-class hybrid provider
  - Streaming dev-mode translation (Vite + Next)
  - Performance benchmarks published in `docs/performance.md`
  - Public-API contract enumerated in `STABILITY.md`
  - TypeScript Language Service plugin (`@autotranslate/typescript-plugin`)
  - Copy-experiments package (`@autotranslate/experiments`)
  - Migration guides for `react-i18next`, `next-intl`, `lingui`, `gt-next`

  What's expected to change before 1.0 GA:
  - Real-world soak (a few weeks of production use across multiple frameworks)
  - A handful of additional formatter slots — `<List>` (`Intl.ListFormat`) and
    `<Unit>` (`Intl.NumberFormat({ style: 'unit' })`) at minimum
  - Final pass on cookbook recipes informed by user feedback

  The on-disk catalog format, runtime hashing scheme, public exports, and CLI
  contracts are all considered frozen modulo bug fixes. See `STABILITY.md`.

### Patch Changes

- Updated dependencies
  [[`4a99f3b`](https://github.com/tamimbinhakim/autotranslate/commit/4a99f3bf00035e83c5754690a5710d264c9c9879),
  [`75ba96c`](https://github.com/tamimbinhakim/autotranslate/commit/75ba96cfa7180524fae55b8c973c1fad51c9cd90)]:
  - @autotranslate/core@1.0.0-beta.0

## 0.2.0

### Minor Changes

- [#52](https://github.com/tamimbinhakim/autotranslate/pull/52)
  [`0f5e052`](https://github.com/tamimbinhakim/autotranslate/commit/0f5e052b821b4eab781c8d843dd28b644ee719b5)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Add standalone
  `t()` and `@autotranslate/zod` integration
  - `@autotranslate/core` now exports `bindTranslator`, `withTranslator`,
    `currentTranslator`, and a synchronous `t(key, params)` from
    `@autotranslate/core/standalone` and `@autotranslate/core/t`. The Node entry
    uses `AsyncLocalStorage` for per-request isolation; browsers fall back to a
    module slot via the `browser` export condition.
  - `AutotranslateCatalog` augmentation point moved to `@autotranslate/core`.
    `@autotranslate/react` re-exports it for ergonomics.
    `autotranslate generate-types` augments core only — re-run it after
    upgrading.
  - The CLI extractor recognizes `import { t } from '@autotranslate/core/t'`
    (and `/standalone`) so non-React call sites flow through the same
    extraction + translation pipeline.
  - New `@autotranslate/zod` package: a Zod v4 error map that translates
    standard issues through the active translator, with bundled English
    fallbacks and adapter sub-paths for Next (`@autotranslate/zod/next`) and
    Remix (`@autotranslate/zod/remix`). Add `@autotranslate/zod/source` to your
    `content` glob to pipe the keys through your usual translation flow.
  - Workspace bumped to Zod v4 (`zod ^4.0.0`). `@autotranslate/core/config`
    swapped `.url()` for `z.url()` and `z.SafeParseReturnType` for
    `z.ZodSafeParseResult`.

### Patch Changes

- Updated dependencies
  [[`01133fd`](https://github.com/tamimbinhakim/autotranslate/commit/01133fd6b48ed7741eef14ce8a52689d05a113a2),
  [`21aadff`](https://github.com/tamimbinhakim/autotranslate/commit/21aadfffaf317b8a2ae95fdbc81ee04e98242412),
  [`0f5e052`](https://github.com/tamimbinhakim/autotranslate/commit/0f5e052b821b4eab781c8d843dd28b644ee719b5)]:
  - @autotranslate/core@0.2.0
