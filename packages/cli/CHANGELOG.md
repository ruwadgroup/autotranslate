# @autotranslate/cli

## 1.0.0-beta.6

### Patch Changes

- Preserve custom JSX component names in auto mode so compound messages
  containing components such as Next.js `Link` resolve their structured catalog
  entries at runtime.

  Remove the internal tag hint before cloning the original component so it does
  not leak into rendered DOM attributes.

## 1.0.0-beta.5

### Patch Changes

- Keep generated auto-mode imports after module directives such as
  `"use client"` and `"use strict"` so transformed Next.js client components
  remain valid.

## 1.0.0-beta.4

### Patch Changes

- Fix package manifests so pnpm consumers receive installable versioned
  dependencies instead of leaked workspace references. Render translated void
  HTML elements such as `<br />` without invalid React children.
- Updated dependencies []:
  - @autotranslate/core@1.0.0-beta.4
  - @autotranslate/providers@1.0.0-beta.4

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

- [`8ab2af6`](https://github.com/ruwadgroup/autotranslate/commit/8ab2af6cd4ab454e3f04a31ae5c1ff00bea82e37)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - The extractor now
  resolves `const KEY = '...'; t(KEY)` and expressionless template literals,
  matching what the `no-dynamic-key` lint rule already accepts as static.
  Previously the lint rule blessed the pattern while the extractor silently
  skipped it, so the string never reached the catalog.

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
  [[`49f6972`](https://github.com/ruwadgroup/autotranslate/commit/49f6972216aca4e497a6b87bf3c9ed819551aea8),
  [`fdbf0fc`](https://github.com/ruwadgroup/autotranslate/commit/fdbf0fc680ff666546254560f5ca851b310c1b6d),
  [`8e63cf9`](https://github.com/ruwadgroup/autotranslate/commit/8e63cf913189c056a82a3c30ee91f26ebfc86011)]:
  - @autotranslate/providers@1.0.0-beta.3
  - @autotranslate/core@1.0.0-beta.3

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

### Patch Changes

- Updated dependencies
  [[`859ad45`](https://github.com/tamimbinhakim/autotranslate/commit/859ad459ffc3f4a20d51a6df003d94967a959fa4)]:
  - @autotranslate/core@1.0.0-beta.2
  - @autotranslate/providers@1.0.0-beta.2

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
  - @autotranslate/providers@1.0.0-beta.1

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

### Patch Changes

- [#63](https://github.com/tamimbinhakim/autotranslate/pull/63)
  [`1e2d44e`](https://github.com/tamimbinhakim/autotranslate/commit/1e2d44e7a23ee381127d55b9dcbb777b25e04f0a)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Migration
  guides + new cookbook recipes
  - `docs/migrating/{react-i18next,next-intl,lingui,gt-next}.md` — step-by-step
    migration paths from each major i18n library.
  - `docs/cookbook/multi-tenant.md` — three patterns for multi-tenant
    translations (build-time per tenant, runtime overrides, AI instruction
    injection per tenant).
  - `docs/cookbook/ab-copy.md` — A/B copy testing patterns layered on external
    experiment frameworks.
  - `docs/cookbook/branded-glossary.md` — four layers of brand-term locking
    (instruction, `<Var>`, overrides, separate config).

  Index updated; no code changes.

- [#61](https://github.com/tamimbinhakim/autotranslate/pull/61)
  [`0305ae8`](https://github.com/tamimbinhakim/autotranslate/commit/0305ae8bd6f15628ce885019067e9d66ed8a9906)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Remove
  `@autotranslate/mcp` from the workspace

  The MCP package was a 0.0.2 stub that duplicated what the CLI + `agents.md`
  already cover. Agents managing autotranslate (Claude Code, Cursor, Windsurf)
  have shell access and a comprehensive single-file reference at
  `node_modules/@autotranslate/cli/dist/agents.md` — wrapping the CLI in a
  JSON-RPC layer added maintenance cost without unique capability.

  The published `@autotranslate/mcp@0.0.2` stays accessible on npm but is no
  longer maintained. Future agentic tooling will live inside the CLI as direct
  subcommands or in adapter packages where appropriate.

- Updated dependencies
  [[`4a99f3b`](https://github.com/tamimbinhakim/autotranslate/commit/4a99f3bf00035e83c5754690a5710d264c9c9879),
  [`75ba96c`](https://github.com/tamimbinhakim/autotranslate/commit/75ba96cfa7180524fae55b8c973c1fad51c9cd90)]:
  - @autotranslate/core@1.0.0-beta.0
  - @autotranslate/providers@1.0.0-beta.0

## 0.2.0

### Minor Changes

- [#56](https://github.com/tamimbinhakim/autotranslate/pull/56)
  [`61ffc77`](https://github.com/tamimbinhakim/autotranslate/commit/61ffc7747be7e31d97a04f7d6326e40da1f8dde6)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Ship
  `dist/agents.md` — a single-file, agent-readable reference for AI assistants
  (Claude Code, Cursor, Windsurf, …). Mirrors Next.js's `dist/docs/index.md`
  convention.

  After installing `@autotranslate/cli`, agents reading the project's
  `node_modules/` find the library's full surface (config, JSX/string
  translation, standalone `t()`, providers, Zod, common patterns, gotchas,
  public API) at:

  ```
  node_modules/@autotranslate/cli/dist/agents.md
  ```

  `autotranslate init` now prints a hint with the path so users can paste it
  into `AGENTS.md` / `CLAUDE.md` / `.cursorrules`.

- [#58](https://github.com/tamimbinhakim/autotranslate/pull/58)
  [`9208324`](https://github.com/tamimbinhakim/autotranslate/commit/92083248aa16b640f12b49cf60d483286d23177d)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - AI provider
  receives within-chunk context for consistency

  `TranslationRequest` gains an optional `context` field — already-translated
  neighbours from the same chunk. The CLI populates it during `translate` per
  chunk: keys whose cache hit is fresh become reference for keys that need
  re-translation.

  The bundled `ai` provider passes the context to the model as a `reference`
  section in the prompt, alongside the changed strings. The system prompt
  explains that reference items are read-only — the model returns translations
  only for the items in the `translate` array.

  Marks the system prompt as `cacheControl: { type: 'ephemeral' }` for Anthropic
  — no-op for short prompts, automatic 90% input savings on cached tokens for
  large `instruction` blocks. OpenAI does prompt caching automatically beyond
  ~1024 tokens; other vendors ignore the option.

  Net effect: when one string in a 50-string chunk changes, the AI sees the 49
  unchanged neighbours' translations as reference and produces output consistent
  with the surrounding copy. No behaviour change for single-string-per-chunk
  cases.

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

- [#59](https://github.com/tamimbinhakim/autotranslate/pull/59)
  [`b0ffbca`](https://github.com/tamimbinhakim/autotranslate/commit/b0ffbca3f91b980ce99c3f0f5a44e9e3b50b3fa6)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Per-chunk
  parallelism + streaming progress for `autotranslate translate`

  `translate` now runs chunks across all targets in parallel up to
  `config.concurrency` (default 8). With multiple locales and many chunks, this
  is dramatically faster — chunks no longer block on one target finishing before
  another starts.

  `TranslateOptions` gains:
  - `concurrency?: number` — override `config.concurrency` per call.
  - `onProgress?: (event) => void` — fires on every chunk's `started` /
    `completed` transition with
    `{ target, chunkPath, status, fetched?, cached?, overridden? }`.

  The CLI binary uses the new callback to render a live spinner — the user sees
  `translating… 12 done, 8 in flight` while a translate runs instead of waiting
  for everything to finish silently.

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
  [[`9208324`](https://github.com/tamimbinhakim/autotranslate/commit/92083248aa16b640f12b49cf60d483286d23177d),
  [`01133fd`](https://github.com/tamimbinhakim/autotranslate/commit/01133fd6b48ed7741eef14ce8a52689d05a113a2),
  [`21aadff`](https://github.com/tamimbinhakim/autotranslate/commit/21aadfffaf317b8a2ae95fdbc81ee04e98242412),
  [`0f5e052`](https://github.com/tamimbinhakim/autotranslate/commit/0f5e052b821b4eab781c8d843dd28b644ee719b5)]:
  - @autotranslate/providers@0.2.0
  - @autotranslate/core@0.2.0

## 0.1.0

### Minor Changes

- [#23](https://github.com/tamimbinhakim/autotranslate/pull/23)
  [`6c0fcff`](https://github.com/tamimbinhakim/autotranslate/commit/6c0fcff23ee0d69f1603669b65e4a244e7564eb3)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Initial
  implementation of `@autotranslate/cli`:
  - **`autotranslate init`** scaffolds `autotranslate.config.ts`.
  - **`autotranslate extract`** scans source files matched by `config.content`
    with `@babel/parser`, extracts `<T>...</T>` JSX blocks (linearized to
    `StructuredMessage` and hashed via `canonicalKey`) and `useT()` literal
    calls (where `t` is bound to a `useT()` invocation), and writes
    `<outDir>/<source>.json` + `<outDir>/.meta.json`. Whitespace collapse
    matches the runtime walker so canonical keys are identical at extract and
    render time.
  - **`autotranslate translate`** loads the source catalog, runs a content-
    hashed cache, applies per-locale overrides, calls the configured provider
    for the diff, and writes per-locale catalogs + an updated cache file.
    `-l, --locale` restricts to a subset of targets.
  - **`autotranslate check`** verifies catalog parity (missing keys, orphan
    keys, invalid ICU strings) and exits non-zero on problems — drop-in for CI.
  - All commands are also exported as a programmatic API (`loadConfig`,
    `extract`, `translate`, `check`, `init`); the programmatic path is the only
    way to use a `name: 'custom'` provider.
  - Lazy imports on AI vendors so users don't need any `@ai-sdk/*` peer dep
    installed unless they actually configure `provider.name === 'ai'`.

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

- [#35](https://github.com/tamimbinhakim/autotranslate/pull/35)
  [`cc749f3`](https://github.com/tamimbinhakim/autotranslate/commit/cc749f3dcb6bfa97c01e2e89dbd6c5d23b12d978)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - ESLint plugin +
  type generation:
  - **`@autotranslate/eslint-plugin`** is no longer a placeholder. Three rules
    ship with the recommended preset (flat-config and legacy):
    - `no-untranslated-jsx` — flag bare string literals in JSX that aren't
      inside a translation marker (`<T>`, `<Var>`, `<Plural>`, `<Branch>`,
      `<Num>`, `<Currency>`, `<DateTime>`, `<RelativeTime>`).
    - `no-dynamic-key` — translator keys must be string literals (or local
      string-literal consts). Dynamic keys break extraction.
    - `valid-icu-format` — every literal key passed to a translator parses as
      ICU MessageFormat.
  - **`autotranslate generate-types`** writes a `.d.ts` that augments
    `@autotranslate/react`'s open `AutotranslateCatalog` interface with the
    literal source-catalog keys. Users get autocomplete on `t(...)` calls while
    still being free to pass arbitrary strings (the `(string & {})` fallback
    keeps the API additive).
  - **`@autotranslate/react`** exports the open `AutotranslateCatalog` interface
    and a `CatalogKey` alias used by `useT` / `useTranslations`. When typegen
    hasn't been run, `CatalogKey` resolves to `string`, so there's zero behavior
    change for existing callers.

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

### Patch Changes

- [#38](https://github.com/tamimbinhakim/autotranslate/pull/38)
  [`5a16e8a`](https://github.com/tamimbinhakim/autotranslate/commit/5a16e8a252722578fb54a1dd93885bed116c3757)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Auto-generated
  slot names for the formatter components (`<Num>`, `<Currency>`, `<DateTime>`,
  `<RelativeTime>`) now use `_` as the index separator (`num_0`, `currency_0`,
  …) instead of `#`. The previous form produced `{num#0}` placeholders in the
  ICU representation, but `#` isn't a valid ICU argument-name character so the
  round-trip through the AI provider (`treeToICU` → translate → `icuToTree`)
  failed to parse on the way back. Pure runtime use never hit this — only
  catalogs translated through an AI provider surfaced the bug.

- [#37](https://github.com/tamimbinhakim/autotranslate/pull/37)
  [`b8d35d1`](https://github.com/tamimbinhakim/autotranslate/commit/b8d35d1ece0430ef5a815c0efa7059cabfaa2c0b)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Fix JSX-text
  whitespace normalization in the extractor to match React's JSX runtime.
  Previously, `<T>...<Marker/>\n  .\n</T>` extracted as `' . '` (with
  surrounding spaces), but at runtime React renders just `.` — canonical keys
  mismatched and translations weren't applied. The extractor now mirrors
  `@babel/types`'s `cleanJSXElementLiteralChild`: whitespace-only lines drop,
  leading whitespace on continuation lines trims, trailing whitespace on
  non-final lines trims, and lines join with single spaces. Multi-space within a
  line is preserved (matches React's behavior).
- Updated dependencies
  [[`fc6cc60`](https://github.com/tamimbinhakim/autotranslate/commit/fc6cc60e06b891d44035053b5a9e3e95e341428a),
  [`fdeb9e2`](https://github.com/tamimbinhakim/autotranslate/commit/fdeb9e2e3ad4f469a4962743c705124e1a9550a5),
  [`e479d12`](https://github.com/tamimbinhakim/autotranslate/commit/e479d129fb7d1f4e3c3212a6b147774472c7341c),
  [`9b95b44`](https://github.com/tamimbinhakim/autotranslate/commit/9b95b440e154f751d4bed6bbd78aa11ac9b8e995),
  [`20478b6`](https://github.com/tamimbinhakim/autotranslate/commit/20478b67c7a51d786607099a889692f1d3f7f266)]:
  - @autotranslate/core@0.1.0
  - @autotranslate/providers@0.1.0
