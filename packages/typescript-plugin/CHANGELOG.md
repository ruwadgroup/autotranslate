# @autotranslate/typescript-plugin

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

- [#74](https://github.com/tamimbinhakim/autotranslate/pull/74)
  [`04196ac`](https://github.com/tamimbinhakim/autotranslate/commit/04196aca78fbc84c55f3845eebbd0d7863b32794)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - New package:
  `@autotranslate/typescript-plugin`

  TypeScript Language Service plugin. Editor-time warning when `t('literal')` is
  called with a key not yet in the source-locale catalog.

  ```json
  // tsconfig.json
  {
    "compilerOptions": {
      "plugins": [{ "name": "@autotranslate/typescript-plugin" }]
    }
  }
  ```

  Tracks `useT()`, `useTranslations()`, and the standalone `t()` from
  `@autotranslate/core/t`. Follows aliasing (`const t = useT()`). Catalog reads
  are cached for 2s. Configurable: `outDir` (default `.translations`), `source`
  (default `en`), `severity` (default `warning`).

  JSX `<T>` checking lives in `@autotranslate/eslint-plugin`; this package
  covers the string-side hooks.

  VS Code: select **TypeScript: Use Workspace Version** so the plugin is loaded.
  JetBrains IDEs pick it up automatically.
