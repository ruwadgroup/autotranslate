# @autotranslate/core

Framework-free runtime, types, ICU MessageFormat, and locale resolution for
[autotranslate](https://github.com/tamimbinhakim/autotranslate).

Zero React, zero filesystem, zero AI. Synchronous. Edge-runtime safe (Node,
browsers, Bun, Vercel Edge, Cloudflare Workers).

```bash
pnpm add @autotranslate/core
```

## Quick features

- **Synchronous translator.** `createTranslator(opts).t(key, params)` returns a
  string. No async, no Promises, no Suspense.
- **ICU MessageFormat.** Full plural / select / number / date / time support.
- **Structured trees.** A canonical message format that survives JSX walks and
  round-trips through ICU for AI translation.
- **Locale resolution.** BCP-47 normalization, `Accept-Language` parsing, RTL
  detection via `Intl.Locale.textInfo`, CLDR plural categories.
- **Stable hashing.** SHA-256 (`@noble/hashes`, audited, pure-JS) for content
  cache keys and `<T>` tree IDs.
- **Schema-validated config.** `defineConfig` is type-preserving; `parseConfig`
  validates via a Zod discriminated union.

## Quick start

```ts
import { createTranslator } from '@autotranslate/core';

const t = createTranslator({
  locale: 'es',
  catalog: { 'Sign out': 'Cerrar sesión' },
  fallback: { 'Sign out': 'Sign out' },
});

t.t('Sign out'); // → 'Cerrar sesión'
t.t('Hello, {name}!', { name: 'Ada' }); // → 'Hello, Ada!'
```

```ts
import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/**/*.{ts,tsx}'],
  provider: { name: 'ai', model: 'anthropic:claude-haiku-4-5' },
});
```

```ts
import { getDirection, matchLocale } from '@autotranslate/core/locale';

matchLocale({
  accept: 'fr-FR;q=0.9, en;q=0.7',
  defaultLocale: 'en',
  supported: ['en', 'fr-CA', 'es'],
}); // → 'fr-CA'

getDirection('ar'); // → 'rtl'
```

## Subpath entries

| Entry                        | Purpose                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| `@autotranslate/core`        | Runtime translator, hashing, structured-tree types               |
| `@autotranslate/core/config` | `defineConfig`, Zod schema, `parseConfig` / `safeParseConfig`    |
| `@autotranslate/core/locale` | BCP-47 utilities, RTL detection, plural categories, locale match |
| `@autotranslate/core/icu`    | ICU MessageFormat parser & formatter, `extractVariables`         |

## API

### `@autotranslate/core`

- `createTranslator(opts)` → `Translator`
- `hash(input, length?)`, `shortHash(input)` — SHA-256 hex helpers
- `canonicalKey(tree, context?)`, `renderTreeToString(tree, locale, params?)`,
  `isStructured(value)`
- Types: `Catalog`, `CatalogEntry`, `Locale`, `Manifest`, `MessageMeta`,
  `StructuredMessage`, `TextNode`, `VarNode`, `PluralNode`, `BranchNode`,
  `TagNode`, `Translator`, `TranslatorOptions`

### `@autotranslate/core/config`

- `defineConfig(config)` — type-preserving identity helper
- `parseConfig(input)`, `safeParseConfig(input)`
- `autotranslateConfigSchema`, `providerConfigSchema`
- Types: `AutotranslateConfig`, `AutotranslateConfigInput`, `ProviderConfig`
  (discriminated union of stub / ai / deepl / google / custom)

### `@autotranslate/core/locale`

- `standardizeLocale`, `isValidLocale`, `getDirection`
- `matchLocale`, `parseAcceptLanguage`, `determineLocale`
- `getLocaleName`, `getLocaleProperties`, `getLocaleEmoji`, `isSameLanguage`
- `getPluralCategory`, `isPluralCategory`, `PLURAL_CATEGORIES`
- Types: `PluralCategory`, `LocaleDirection`, `LocaleProperties`

### `@autotranslate/core/icu`

- `parseICU`, `formatICU`, `extractVariables`
- `ICUParseError`

> **Note**: `@autotranslate/core/internal` is a workspace-private subpath shared
> between `@autotranslate/cli`, `@autotranslate/react`, and
> `@autotranslate/providers`. **It is not part of the public API** and may break
> without notice. Application code should not import from it.

## Design notes

- **Hashing:** 12-character SHA-256 prefix is used as the canonical key for
  `<T>` trees. 48 bits of entropy keeps collisions below 1e-6 up to ~6,000
  distinct keys.
- **ICU:** non-finite plural counts fall back to the `other` form with `#`
  blanked. Identical behavior in `formatICU` and `renderTreeToString`.
- **Provider config:** Zod discriminated union, so `name: 'ai'` requires `model`
  at type-check time.
- **No file IO.** Catalog persistence lives in `@autotranslate/cli`.
