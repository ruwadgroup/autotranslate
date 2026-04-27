# @autotranslate/cli

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
