# @autotranslate/next

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
