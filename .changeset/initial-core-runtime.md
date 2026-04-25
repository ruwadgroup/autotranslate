---
'@autotranslate/core': minor
---

Initial implementation of `@autotranslate/core`:

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
