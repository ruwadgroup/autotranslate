# @autotranslate/react

## 0.1.0

### Minor Changes

- [#22](https://github.com/tamimbinhakim/autotranslate/pull/22)
  [`aead127`](https://github.com/tamimbinhakim/autotranslate/commit/aead127051a3147fdf50c88464ae00bc375707f0)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Initial
  implementation of `@autotranslate/react`:
  - `<T>` JSX component that walks children, derives a canonical message tree,
    hashes it to a key, looks up the translation in the active catalog, and
    renders the translated tree using the original `<Var>` / `<Plural>` / HTML
    elements as templates so props and event handlers carry over.
  - `<Var name?>{value}</Var>` variable slot marker (default name `value`).
  - `<Plural value name? zero? one? two? few? many? other />` plural marker with
    CLDR category selection via `Intl.PluralRules` and `#` substitution.
  - `<TranslationProvider locale catalog? fallback? />` — locale + catalog
    context. Missing provider degrades gracefully to source rendering.
  - `useT()` — hook returning `(key, params?) => string` for plain-string
    translation (labels, `aria-*`, etc.).
  - `useLocale()` — hook returning the active locale.
  - `@autotranslate/react/server` subpath with
    `getT(locale, loadCatalog, loadFallback?)` async factory and a re-exported
    `createTranslator` for RSC / SSR / route handlers / edge runtimes. The
    `react-server` export condition is wired so RSC bundlers pick this entry
    automatically.

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

- [#39](https://github.com/tamimbinhakim/autotranslate/pull/39)
  [`4fb95b8`](https://github.com/tamimbinhakim/autotranslate/commit/4fb95b8328bd6f00b92d36079fab47c023e92401)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Recognize
  translation markers (`<Var>`, `<Plural>`, `<Branch>`, `<Num>`, `<Currency>`,
  `<DateTime>`, `<RelativeTime>`) when their JSX `type` field is a
  `React.lazy`-shaped wrapper. Next.js / RSC server components rendering a
  client component substitute the type with a `{$$typeof, _payload, _init}`
  thunk, so the previous identity check (`child.type === Var`) silently failed
  and every marker fell through to the generic `tag` path — translations were
  correctly written to the catalog but never matched at runtime, so SSR rendered
  the source copy.

  The serializer now resolves the lazy payload synchronously when present and
  matches by `displayName` as a fallback. Identity-equal markers still take the
  fast path; copy-equality still works in pure-client / Vite setups.

- [#28](https://github.com/tamimbinhakim/autotranslate/pull/28)
  [`b8cb781`](https://github.com/tamimbinhakim/autotranslate/commit/b8cb781bfb6c4a68b651d5d94b0e11e0cc8ba9ac)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Add
  `"use client"` directive to the main bundle so Next.js App Router / RSC
  bundlers treat the package as a client module. Every export from
  `@autotranslate/react` (the `<T>` / `<Var>` / `<Plural>` components, `useT`,
  `useLocale`, `TranslationProvider`) touches React hooks or context and was
  already client-only in practice — this just makes the contract explicit so
  server components can import the package without hitting
  `"You're importing a component that needs ... use client"` build errors.

  The directive is injected via a tsup `onSuccess` hook because esbuild strips
  top-of-file directives during bundling. The `/server` subpath is unchanged —
  it's still picked by the `react-server` export condition for RSC consumers.

- Updated dependencies
  [[`fc6cc60`](https://github.com/tamimbinhakim/autotranslate/commit/fc6cc60e06b891d44035053b5a9e3e95e341428a),
  [`e479d12`](https://github.com/tamimbinhakim/autotranslate/commit/e479d129fb7d1f4e3c3212a6b147774472c7341c),
  [`9b95b44`](https://github.com/tamimbinhakim/autotranslate/commit/9b95b440e154f751d4bed6bbd78aa11ac9b8e995),
  [`20478b6`](https://github.com/tamimbinhakim/autotranslate/commit/20478b67c7a51d786607099a889692f1d3f7f266)]:
  - @autotranslate/core@0.1.0
