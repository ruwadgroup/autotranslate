# @autotranslate/eslint-plugin

## 0.1.0

### Minor Changes

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

### Patch Changes

- Updated dependencies
  [[`fc6cc60`](https://github.com/tamimbinhakim/autotranslate/commit/fc6cc60e06b891d44035053b5a9e3e95e341428a),
  [`e479d12`](https://github.com/tamimbinhakim/autotranslate/commit/e479d129fb7d1f4e3c3212a6b147774472c7341c),
  [`9b95b44`](https://github.com/tamimbinhakim/autotranslate/commit/9b95b440e154f751d4bed6bbd78aa11ac9b8e995),
  [`20478b6`](https://github.com/tamimbinhakim/autotranslate/commit/20478b67c7a51d786607099a889692f1d3f7f266)]:
  - @autotranslate/core@0.1.0
