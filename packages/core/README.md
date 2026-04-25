# @autotranslate/core

Framework-agnostic core for
[autotranslate](https://github.com/tamimbinhakim/autotranslate). Configuration
schema, runtime translator, locale resolution, ICU MessageFormat utilities, and
the structured-message tree shape shared by extractor and runtime.

Zero React, zero filesystem, zero AI provider dependencies — those live in
dedicated packages. The runtime is synchronous and works in Node, browsers, Bun,
and edge runtimes (Vercel Edge, Cloudflare Workers).

```bash
pnpm add @autotranslate/core
```

## Subpath entries

| Entry                        | Purpose                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| `@autotranslate/core`        | Runtime translator, hashing, structured-tree types               |
| `@autotranslate/core/config` | `defineConfig`, Zod schema, `parseConfig` / `safeParseConfig`    |
| `@autotranslate/core/locale` | BCP-47 utilities, RTL detection, plural categories, locale match |
| `@autotranslate/core/icu`    | ICU MessageFormat parser & formatter, `extractVariables`         |

## Quick reference

```ts
import { createTranslator } from '@autotranslate/core';

const t = createTranslator({
  locale: 'es',
  catalog: { 'Sign out': 'Cerrar sesión' },
  fallback: { 'Sign out': 'Sign out' },
});

t.t('Sign out'); // 'Cerrar sesión'
t.t('Hello, {name}!', { name: 'Ada' }); // 'Hello, Ada!'
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
import { matchLocale, getDirection } from '@autotranslate/core/locale';

matchLocale({
  accept: 'fr-FR;q=0.9, en;q=0.7',
  defaultLocale: 'en',
  supported: ['en', 'fr-CA', 'es'],
}); // 'fr-CA'

getDirection('ar'); // 'rtl'
```

## Public API

### `@autotranslate/core`

- `createTranslator(opts)` → `Translator`
- `hash(input, length?)`, `shortHash(input)` — SHA-256 hex helpers
- `canonicalize(tree)`, `canonicalKey(tree)`, `TREE_KEY_PREFIX`
- `renderTreeToString(tree, locale, params?)`, `isStructured(value)`
- Types: `Catalog`, `CatalogEntry`, `Locale`, `Manifest`, `MessageMeta`,
  `StructuredMessage`, `TextNode`, `VarNode`, `PluralNode`, `TagNode`,
  `Translator`, `TranslatorOptions`

### `@autotranslate/core/config`

- `defineConfig(config)` — type-preserving identity helper
- `parseConfig(input)`, `safeParseConfig(input)`
- `autotranslateConfigSchema`, `providerConfigSchema`
- Types: `AutotranslateConfig`, `AutotranslateConfigInput`, `ProviderConfig`
  (discriminated:
  `StubProviderConfig | AIProviderConfig | CustomProviderConfig`)

### `@autotranslate/core/locale`

- `standardizeLocale`, `isValidLocale`, `getDirection`
- `matchLocale`, `parseAcceptLanguage`
- `getPluralCategory`, type `PluralCategory`, type `LocaleDirection`

### `@autotranslate/core/icu`

- `parseICU`, `formatICU`, `extractVariables`
- `ICUParseError`

## Design notes

- **Hashing** uses SHA-256 from `@noble/hashes` (audited, pure-JS, edge-safe).
  Tree keys are 12-character truncations of the SHA-256 of the canonical JSON
  form of the tree.
- **ICU** uses `@formatjs/icu-messageformat-parser`. Plural with non-finite
  count falls back to the `other` form with `#` blanked.
- **Provider config** is a Zod discriminated union, so `name: 'ai'` requires
  `model` at type-check time.
- **No file IO** in this package. Catalog persistence lives in
  `@autotranslate/cli`.
