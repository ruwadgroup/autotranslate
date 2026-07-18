# @autotranslate/core

## 1.0.0-beta.7

### Patch Changes

- [`7d3d2d4`](https://github.com/ruwadgroup/autotranslate/commit/7d3d2d40eac596a76d1a80181ef614a3ff49b89e)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Restrict
  auto-mode host-attribute translation to a positive set of visual and
  accessibility copy attributes. Unknown HTML, SVG, ARIA, React, and library
  attributes now remain structural by default, preventing values such as
  `viewBox`, `role`, `aria-live`, SVG paint, file-accept filters, and numeric
  geometry from entering translation catalogs or being rewritten at runtime.

## 1.0.0-beta.6

### Minor Changes

- [`bd0c24a`](https://github.com/ruwadgroup/autotranslate/commit/bd0c24ae45f826f0d07b5bca48f4900f27c73ac0)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Auto mode now
  translates host-element copy attributes. In a `"use client"` file,
  `mode: 'auto'` rewrites `<input placeholder="Search cases" />` to
  `<input placeholder={t("Search cases")} />` and injects (or reuses) a
  `const t = useT()` binding in the enclosing component/hook. Non-copy
  attributes (`className`, `href`, `type`, `data-*`, …) and custom-component
  props are left alone; `data-no-translate` opts an element out. Because
  `useT()` is a client hook, this runs only in client modules — server-component
  attributes remain lint warnings.

  - `@autotranslate/core`: new `isTranslatableAttribute` classifier export;
    `CLASSIFIER_VERSION` bumped to 3.
  - `@autotranslate/cli`: `transformAutoWrap` handles copy attributes; the
    extractor's transform-then-extract path keeps keys identical to hand-written
    `useT()`.
  - `@autotranslate/eslint-plugin`: `no-untranslated-jsx` gains an `autoMode`
    option that suppresses the host-element attribute warnings the compiler now
    handles.

## 1.0.0-beta.5

### Patch Changes

- Detect catalog-backed interface copy carried through semantic component fields
  such as `label`, `title`, and `description` in auto mode.

  Extract static values for those fields, translate their dynamic JSX render
  sites, and keep lint classification aligned while leaving unrelated dynamic
  data untouched.

## 1.0.0-beta.4

### Patch Changes

- Fix package manifests so pnpm consumers receive installable versioned
  dependencies instead of leaked workspace references. Render translated void
  HTML elements such as `<br />` without invalid React children.

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

## 1.0.0-beta.2

### Minor Changes

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

- [#64](https://github.com/tamimbinhakim/autotranslate/pull/64)
  [`4a99f3b`](https://github.com/tamimbinhakim/autotranslate/commit/4a99f3bf00035e83c5754690a5710d264c9c9879)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Glossary
  support + first-class hybrid provider

  **`glossary` config field** — a flat array of brand / proper-noun terms the AI
  must never translate or transliterate. The CLI prepends the glossary to the
  provider's instruction at translate time.

  ```ts
  defineConfig({
    // …
    glossary: ['autotranslate', 'API', 'SDK'],
    instruction: 'Friendly tone.',
  });
  ```

  The merged instruction the provider receives:

  ```
  Glossary — preserve these terms exactly; never translate or transliterate:
  - autotranslate
  - API
  - SDK

  Friendly tone.
  ```

  **`hybrid` provider** — built-in provider that routes structured-tree entries
  (`<T>` blocks, plurals, branches) to an `ai` provider and plain strings
  (`useT` literals, dictionary keys) to DeepL or Google.

  ```ts
  provider: {
    name: 'hybrid',
    ai: { name: 'ai', model: 'anthropic:claude-haiku-4-5', apiKey: process.env.ANTHROPIC_API_KEY },
    plain: { name: 'deepl', apiKey: process.env.DEEPL_API_KEY },
  }
  ```

  Lives at `@autotranslate/providers/hybrid` (`createHybridProvider`). Cache
  signature combines both providers' signatures.

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

- [#54](https://github.com/tamimbinhakim/autotranslate/pull/54)
  [`01133fd`](https://github.com/tamimbinhakim/autotranslate/commit/01133fd6b48ed7741eef14ce8a52689d05a113a2)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Bump
  `@noble/hashes` to v2.2 and `@types/node` to v25 across the workspace.

  `@noble/hashes` v2 requires `.js` extensions in import paths and dropped
  string-input support; `core/src/hash.ts` now imports from
  `@noble/hashes/sha2.js` and `@noble/hashes/utils.js` and wraps the input
  through `utf8ToBytes` before hashing.

## 0.1.0

### Minor Changes

- [#14](https://github.com/tamimbinhakim/autotranslate/pull/14)
  [`fc6cc60`](https://github.com/tamimbinhakim/autotranslate/commit/fc6cc60e06b891d44035053b5a9e3e95e341428a)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Initial
  implementation of `@autotranslate/core`:
  - `createTranslator(opts)` runtime with ICU formatting and structured-tree
    fallback rendering.
  - SHA-256 hashing (`hash`, `shortHash`) using `@noble/hashes` for edge-safe,
    synchronous canonical key derivation.
  - Structured-message tree shape (`StructuredMessage`, `TextNode`, `VarNode`,
    `PluralNode`, `TagNode`) with stable canonicalization (`canonicalize`,
    `canonicalKey`).
  - ICU MessageFormat parser/formatter (`@autotranslate/core/icu`) supporting
    literal, argument, plural (cardinal, with `=N` exact match), select, pound,
    tag, number (`Intl.NumberFormat`), and date/time (`Intl.DateTimeFormat`).
  - Locale utilities (`@autotranslate/core/locale`): `standardizeLocale`,
    `isValidLocale`, `getDirection` (RTL detection), `matchLocale` with
    path/cookie/Accept-Language precedence, `parseAcceptLanguage`,
    `getPluralCategory` (cardinal + ordinal).
  - Configuration schema (`@autotranslate/core/config`) with Zod-validated
    discriminated provider union (`stub` | `ai` | `custom`), `defineConfig`
    generic helper, `parseConfig`, `safeParseConfig`.

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

- [#36](https://github.com/tamimbinhakim/autotranslate/pull/36)
  [`9b95b44`](https://github.com/tamimbinhakim/autotranslate/commit/9b95b440e154f751d4bed6bbd78aa11ac9b8e995)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Real DeepL +
  Google Cloud Translation providers:
  - **`@autotranslate/providers/deepl`**: replaces the v0.5-placeholder stub
    with a real `fetch`-based implementation. Plain-string entries only;
    structured-tree entries raise a clear error pointing at the `ai` provider.
    Features: API-key auth, configurable endpoint (paid / free-tier),
    `formality` pass-through, optional `context` hint, configurable BCP-47 →
    DeepL locale map, batched requests, ICU-placeholder shielding via opaque
    sentinels so DeepL only sees natural-language text.
  - **`@autotranslate/providers/google`**: same shape against Google Cloud
    Translation v2. API-key auth, `format: 'text'`, BCP-47 pass-through with
    optional override map, batched requests, the same placeholder shield.
  - **`@autotranslate/providers/placeholder-shield`**: shared reversible encoder
    for `{name}` / `{n, number}` / `{d, date}` / `{t, time}` ICU arguments →
    opaque `[[ATPH:N]]` sentinels. Throws on plural / select / pound / tag input
    so callers route those entries to the AI provider.
  - **`@autotranslate/core/config`**: discriminated provider union now accepts
    `name: 'deepl'` and `name: 'google'`. Schemas validate `apiKey`
    - provider-specific options (formality, endpoint, locale map).
  - **`@autotranslate/cli`**: provider resolver wires both new providers through
    the existing `translate` flow. No CLI surface change.

- [#41](https://github.com/tamimbinhakim/autotranslate/pull/41)
  [`20478b6`](https://github.com/tamimbinhakim/autotranslate/commit/20478b67c7a51d786607099a889692f1d3f7f266)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Trim the public
  API surface to the symbols end-users actually call.

  `@autotranslate/core` — workspace-internal helpers (`BRANCH_RESERVED_PROPS`,
  `FORMAT_MARKER_PREFIX`, `MARKER_NAMES`, `mergeAdjacentText`,
  `TREE_KEY_PREFIX`, `CONTEXT_KEY_SEPARATOR`, `applyContextToKey`,
  `canonicalize`) move from the main entry to a new
  `@autotranslate/core/internal` subpath that is explicitly marked as not part
  of the public API and may break in any release without notice.

  `@autotranslate/cli` — `resolveProvider`, `readCatalog`, `writeCatalog`,
  `readManifest`, `writeManifest`, `localeCatalogPath`, and `CatalogFile` are no
  longer exported. They were internal CLI persistence helpers; the public
  programmatic API exposes `loadConfig`, `init`, `extract`, `translate`,
  `generateTypes`, and `check`.

  If you imported any of the removed symbols from the public entry, update the
  import path or use the public alternatives.
