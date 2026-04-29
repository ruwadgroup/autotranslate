# @autotranslate/zod

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
