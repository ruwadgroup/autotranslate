# @autotranslate/next

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
