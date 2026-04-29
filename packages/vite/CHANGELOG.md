# @autotranslate/vite

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

- [#65](https://github.com/tamimbinhakim/autotranslate/pull/65)
  [`3633841`](https://github.com/tamimbinhakim/autotranslate/commit/3633841b9332178b70fcc41d18e6581ff34c4a63)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Streaming
  dev-mode translation

  In dev, missing keys can now translate on first miss. The runtime hook plus a
  Vite middleware close the "edit a string → see it translated" loop without
  manually running `pnpm i18n`.

  ```ts
  // vite.config.ts
  import autotranslate from '@autotranslate/vite';
  export default { plugins: [autotranslate({ streaming: true })] };
  ```

  ```tsx
  // app entry — dev only
  import { TranslationProvider, createDevOnMissing } from '@autotranslate/react';

  <TranslationProvider
    locale={locale}
    catalog={catalog}
    onMissing={import.meta.env.DEV ? createDevOnMissing() : undefined}
  >
  ```

  When `useT('New string')` hits a key that isn't in the catalog yet, the
  runtime POSTs to the dev endpoint, the server runs translate for that key, the
  chunk is updated, and Vite's existing HMR triggers a reload.

  Production: omit `onMissing`. The runtime falls back to source on miss (same
  behaviour as today).

  Next.js streaming dev mode is on the v0.9 roadmap; today the Next adapter
  relies on running `pnpm i18n` between edits.

### Patch Changes

- Updated dependencies
  [[`4a99f3b`](https://github.com/tamimbinhakim/autotranslate/commit/4a99f3bf00035e83c5754690a5710d264c9c9879),
  [`1e2d44e`](https://github.com/tamimbinhakim/autotranslate/commit/1e2d44e7a23ee381127d55b9dcbb777b25e04f0a),
  [`0305ae8`](https://github.com/tamimbinhakim/autotranslate/commit/0305ae8bd6f15628ce885019067e9d66ed8a9906),
  [`75ba96c`](https://github.com/tamimbinhakim/autotranslate/commit/75ba96cfa7180524fae55b8c973c1fad51c9cd90)]:
  - @autotranslate/core@1.0.0-beta.0
  - @autotranslate/cli@1.0.0-beta.0

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

## 0.1.0

### Minor Changes

- [#30](https://github.com/tamimbinhakim/autotranslate/pull/30)
  [`25ae59b`](https://github.com/tamimbinhakim/autotranslate/commit/25ae59b65f9aa351a478cd055ff29eb9b5835d6b)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Initial
  implementation of `@autotranslate/vite`:
  - Default-export plugin factory that resolves a `virtual:autotranslate` module
    exporting `catalogs`, `source`, and `locales` populated at build time from
    `.translations/*.json`.
  - Auto-loads `autotranslate.config.{ts,mts,js,mjs}` from the Vite project root
    via `jiti`. Plugin options override every config-derived value; pass
    `config` to skip the disk lookup entirely (useful when the same config is
    already imported in `vite.config.ts`).
  - Dev-mode HMR: watches `<outDir>` and triggers a full reload when any locale
    JSON changes, so re-running `pnpm i18n` propagates without a manual refresh.
  - `@autotranslate/vite/client` subpath ships a `client.d.ts` that declares the
    `virtual:autotranslate` module — add it to `types` in your `tsconfig` once
    and the imports type-check cleanly.
  - 6 tests covering virtual-module resolution, catalog inlining, missing-
    catalog tolerance, inline-config option, and the no-match short-circuit.

### Patch Changes

- Updated dependencies
  [[`fc6cc60`](https://github.com/tamimbinhakim/autotranslate/commit/fc6cc60e06b891d44035053b5a9e3e95e341428a),
  [`e479d12`](https://github.com/tamimbinhakim/autotranslate/commit/e479d129fb7d1f4e3c3212a6b147774472c7341c),
  [`9b95b44`](https://github.com/tamimbinhakim/autotranslate/commit/9b95b440e154f751d4bed6bbd78aa11ac9b8e995),
  [`20478b6`](https://github.com/tamimbinhakim/autotranslate/commit/20478b67c7a51d786607099a889692f1d3f7f266)]:
  - @autotranslate/core@0.1.0
