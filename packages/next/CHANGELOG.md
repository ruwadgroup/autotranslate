# @autotranslate/next

## 1.0.0-beta.6

### Patch Changes

- Preserve custom JSX component names in auto mode so compound messages
  containing components such as Next.js `Link` resolve their structured catalog
  entries at runtime.

  Remove the internal tag hint before cloning the original component so it does
  not leak into rendered DOM attributes.

- Updated dependencies []:
  - @autotranslate/cli@1.0.0-beta.6
  - @autotranslate/react@1.0.0-beta.5

## 1.0.0-beta.5

### Patch Changes

- Updated dependencies []:
  - @autotranslate/cli@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- Fix package manifests so pnpm consumers receive installable versioned
  dependencies instead of leaked workspace references. Render translated void
  HTML elements such as `<br />` without invalid React children.
- Updated dependencies []:
  - @autotranslate/cli@1.0.0-beta.4
  - @autotranslate/core@1.0.0-beta.4
  - @autotranslate/react@1.0.0-beta.4

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
  [[`8ab2af6`](https://github.com/ruwadgroup/autotranslate/commit/8ab2af6cd4ab454e3f04a31ae5c1ff00bea82e37),
  [`fdbf0fc`](https://github.com/ruwadgroup/autotranslate/commit/fdbf0fc680ff666546254560f5ca851b310c1b6d),
  [`8e63cf9`](https://github.com/ruwadgroup/autotranslate/commit/8e63cf913189c056a82a3c30ee91f26ebfc86011)]:
  - @autotranslate/cli@1.0.0-beta.3
  - @autotranslate/core@1.0.0-beta.3
  - @autotranslate/react@1.0.0-beta.3

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
  - @autotranslate/cli@1.0.0-beta.2
  - @autotranslate/react@1.0.0-beta.2

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
  - @autotranslate/cli@1.0.0-beta.1
  - @autotranslate/react@1.0.0-beta.1

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

### Minor Changes

- [#66](https://github.com/tamimbinhakim/autotranslate/pull/66)
  [`1e3f227`](https://github.com/tamimbinhakim/autotranslate/commit/1e3f2276f432509b3e04fdb169b64ded9481c0b4)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Streaming
  dev-mode translation for Next.js

  `@autotranslate/next/streaming` exports a `POST` handler that, in dev,
  translates a new key on demand and writes it to the chunked catalog.

  ```ts
  // app/api/__autotranslate/translate/route.ts
  export { POST } from '@autotranslate/next/streaming';
  ```

  Wire the runtime via `createDevOnMissing` from `@autotranslate/react` (point
  its `endpoint` option at the same path). In production the handler returns 404
  — `NODE_ENV` gates it.

  Closes the "edit a string → see it translated" loop in Next dev without
  manually running `pnpm i18n` between edits. Caches are cleared automatically;
  the next request picks up the new translation.

### Patch Changes

- Updated dependencies
  [[`4a99f3b`](https://github.com/tamimbinhakim/autotranslate/commit/4a99f3bf00035e83c5754690a5710d264c9c9879),
  [`1e2d44e`](https://github.com/tamimbinhakim/autotranslate/commit/1e2d44e7a23ee381127d55b9dcbb777b25e04f0a),
  [`0305ae8`](https://github.com/tamimbinhakim/autotranslate/commit/0305ae8bd6f15628ce885019067e9d66ed8a9906),
  [`3633841`](https://github.com/tamimbinhakim/autotranslate/commit/3633841b9332178b70fcc41d18e6581ff34c4a63),
  [`75ba96c`](https://github.com/tamimbinhakim/autotranslate/commit/75ba96cfa7180524fae55b8c973c1fad51c9cd90)]:
  - @autotranslate/core@1.0.0-beta.0
  - @autotranslate/cli@1.0.0-beta.0
  - @autotranslate/react@1.0.0-beta.0

## 0.2.0

### Minor Changes

- [#57](https://github.com/tamimbinhakim/autotranslate/pull/57)
  [`21aadff`](https://github.com/tamimbinhakim/autotranslate/commit/21aadfffaf317b8a2ae95fdbc81ee04e98242412)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Chunked catalog
  and cache layout

  `.translations/` is now a tree, not flat files. The CLI groups keys into
  chunks by their alphabetically-first occurrence's source file:

  ```
  .translations/
    en/
      components/Header.json
      pages/Checkout.json
      _external/zod.json
    es/  …
    .cache/<provider-sig>/<source-target>/<chunk>.json
  ```

  Wins:
  - **Reviewable diffs.** A 5-string copy change shows up in 1-2 small chunk
    files instead of buried in a multi-thousand-line catalog.
  - **Skip-on-no-change.** Each chunk caches its `chunkHash`; runs where
    `chunkHash` matches skip the API entirely. No-op CI passes are now
    effectively free.
  - **Better consistency.** Within a chunk, unchanged neighbouring strings ride
    along as context for AI re-translation of changed strings.
  - **Auto-split.** Chunks exceeding 300 strings split alphabetically
    (`Foo.0.json`, `Foo.1.json`). Default cap configurable.

  Migration: silent, on first `translate` run after upgrade. The flat
  `<locale>.json` source file is reshaped into the chunked tree; legacy
  `.cache/<sig>.json` files are pruned (cache resets — first run is a cold
  pass).

  `fsCatalogLoader` (Next) and the Vite plugin walk the new tree recursively.
  Both retain a fallback to the flat layout for users mid- upgrade — the runtime
  never breaks during the transition.

  New helpers in `@autotranslate/core/internal`:
  - `chunkPathFor(meta)` — pure function returning the chunk path for a key
  - `buildChunkLayout(manifest, options?)` — chunk path → keys map

### Patch Changes

- Updated dependencies
  [[`01133fd`](https://github.com/tamimbinhakim/autotranslate/commit/01133fd6b48ed7741eef14ce8a52689d05a113a2),
  [`21aadff`](https://github.com/tamimbinhakim/autotranslate/commit/21aadfffaf317b8a2ae95fdbc81ee04e98242412),
  [`0f5e052`](https://github.com/tamimbinhakim/autotranslate/commit/0f5e052b821b4eab781c8d843dd28b644ee719b5)]:
  - @autotranslate/core@0.2.0
  - @autotranslate/react@0.1.1

## 0.1.0

### Minor Changes

- [#27](https://github.com/tamimbinhakim/autotranslate/pull/27)
  [`7277795`](https://github.com/tamimbinhakim/autotranslate/commit/727779561ab8579c171834a9974435a0ab6a258c)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Initial
  implementation of `@autotranslate/next`, targeting Next.js 16+.
  - **`@autotranslate/next`** server entry exposes `getT(locale, options?)`
    (async translator factory with a default fs-backed catalog loader and
    `fallback` source-locale support), `getRequestLocale()` (reads the
    `x-autotranslate-locale` header set by the proxy), and
    `fsCatalogLoader(cwd, outDir)` for callers that want to compose the default
    loader. The fs loader memoizes per `(cwd, outDir, locale)` tuple;
    `clearCatalogCache()` drops the cache for tests / HMR.
  - **`@autotranslate/next/middleware`** ships `createNextMiddleware(options)` —
    a `proxy`-compatible function (Next 16 renamed `middleware` → `proxy`)
    supporting both `'prefix'` (default, redirects bare paths to `/<locale>/...`
    and strips the default-locale prefix unless `prefixDefaultLocale: true`) and
    `'cookie'` strategies (`NEXT_LOCALE` cookie by default; configurable). In
    both modes the resolved locale is pushed downstream via the
    `x-autotranslate-locale` header so server components can read it via
    `getRequestLocale()`.
  - **`@autotranslate/next/plugin`** ships `withAutotranslate(config)` — a typed
    pass-through today that exists as the canonical integration point for future
    build-time hooks (typegen on `next build`, catalog inlining, dev-mode HMR).
  - 16 tests across `middleware.test.ts`, `catalog-loader.test.ts`, and
    `index.test.ts`.

- [#34](https://github.com/tamimbinhakim/autotranslate/pull/34)
  [`e479d12`](https://github.com/tamimbinhakim/autotranslate/commit/e479d129fb7d1f4e3c3212a6b147774472c7341c)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - GT-parity
  additions across the toolkit:
  - **`@autotranslate/react`**: new `<Branch>` discriminator marker, `<Num>` /
    `<Currency>` / `<DateTime>` / `<RelativeTime>` `Intl`-backed formatter
    components, `useTranslations(namespace?)` dictionary hook, and a `context`
    prop on `<T>` for translator-facing disambiguation hints.
  - **`@autotranslate/core`**:
    - `BranchNode` added to the structured-message types; rendered by both
      `renderTreeToString` and the React `<T>` renderer.
    - `canonicalKey(tree, context?)` now mixes context into the hash so
      identical copy with different contexts produces distinct keys.
    - `applyContextToKey` + `CONTEXT_KEY_SEPARATOR` exposed for callers that
      compose their own lookup keys.
    - `createTranslator` recognizes reserved `$context` / `$description` /
      `$maxChars` options on `t()` — `$context` reroutes the lookup; the rest
      are ignored at runtime but flow through to AI providers via the manifest.
    - New locale utilities: `getLocaleName`, `getLocaleEmoji`,
      `getLocaleProperties`, `isSameLanguage`, `determineLocale`.
    - Config: optional `dictionary` path for `useTranslations` / dictionary
      mode.
  - **`@autotranslate/next`**: new `getTranslations(locale, namespace?)` server
    helper for dictionary-mode lookups in RSC.
  - **`@autotranslate/cli`**: extractor recognizes `<Branch>`, the four
    formatter components, `maxChars` / `description` JSX attributes, and
    `t('...', { $context, $maxChars, $description })` calls. `extract` now also
    flattens the optional dictionary file into the source catalog.
  - **`@autotranslate/providers`**: AI provider request payload now carries
    per-item `maxChars`; `treeToICU` / `icuToTree` now round-trip `BranchNode`
    via ICU `select`. Pseudo provider walks branch nodes.

### Patch Changes

- Updated dependencies
  [[`5a16e8a`](https://github.com/tamimbinhakim/autotranslate/commit/5a16e8a252722578fb54a1dd93885bed116c3757),
  [`4fb95b8`](https://github.com/tamimbinhakim/autotranslate/commit/4fb95b8328bd6f00b92d36079fab47c023e92401),
  [`fc6cc60`](https://github.com/tamimbinhakim/autotranslate/commit/fc6cc60e06b891d44035053b5a9e3e95e341428a),
  [`aead127`](https://github.com/tamimbinhakim/autotranslate/commit/aead127051a3147fdf50c88464ae00bc375707f0),
  [`b8cb781`](https://github.com/tamimbinhakim/autotranslate/commit/b8cb781bfb6c4a68b651d5d94b0e11e0cc8ba9ac),
  [`e479d12`](https://github.com/tamimbinhakim/autotranslate/commit/e479d129fb7d1f4e3c3212a6b147774472c7341c),
  [`cc749f3`](https://github.com/tamimbinhakim/autotranslate/commit/cc749f3dcb6bfa97c01e2e89dbd6c5d23b12d978),
  [`9b95b44`](https://github.com/tamimbinhakim/autotranslate/commit/9b95b440e154f751d4bed6bbd78aa11ac9b8e995),
  [`20478b6`](https://github.com/tamimbinhakim/autotranslate/commit/20478b67c7a51d786607099a889692f1d3f7f266)]:
  - @autotranslate/react@0.1.0
  - @autotranslate/core@0.1.0
