# @autotranslate/core

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
