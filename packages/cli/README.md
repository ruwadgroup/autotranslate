# @autotranslate/cli

The `autotranslate` command. Scans your codebase, extracts translatable strings,
runs them through a provider, and writes locale catalogs.

```bash
pnpm add -D @autotranslate/cli
npx autotranslate init
npx autotranslate extract
npx autotranslate translate
npx autotranslate check
```

## Commands

### `autotranslate init`

Scaffold `autotranslate.config.ts` in the current directory. No-op if one
exists; pass `--force` to overwrite.

### `autotranslate extract`

Glob `config.content`, parse every TS / JSX file with `@babel/parser`, and write
the canonical source-locale catalog to `<outDir>/<config.source>.json` plus
per-key metadata to `<outDir>/.meta.json`.

Two patterns are recognized:

- **`<T>...</T>`** — children are linearized to a `StructuredMessage` and hashed
  via `canonicalKey` from `@autotranslate/core`. Whitespace collapse matches the
  runtime walker so the canonical key is identical at extract and render time.
- **`useT()` literal calls** — `t('literal')` where `t` is bound to a `useT()`
  invocation in the same file. The literal becomes both the key and the source.

### `autotranslate translate`

Translate the source catalog into every target locale. For each target:

1. Read existing `<outDir>/<locale>.json`.
2. Load the per-(source, target, provider-signature) cache.
3. Diff: skip keys whose source-content hash matches the cached translation.
4. Apply per-locale `overrides` from the config.
5. Send what's left to the configured provider.
6. Write the merged catalog and update the cache.

`-l, --locale <locale...>` restricts to a subset of target locales.

### `autotranslate generate-types`

Read the source-locale catalog and emit a `.d.ts` that augments
`@autotranslate/react`'s `AutotranslateCatalog` interface with the literal key
set. `useT('Sing out')` becomes a TypeScript error.

### `autotranslate check`

Verify catalog parity. Reports:

- **missing** — source key absent from a target locale
- **orphan** — target key no longer in source
- **invalid-icu** — string entry that doesn't parse as ICU MessageFormat

Exits non-zero on problems — wire it into CI.

## Programmatic API

Every command is also a function:

```ts
import {
  check,
  extract,
  generateTypes,
  init,
  loadConfig,
  translate,
} from '@autotranslate/cli';

const resolved = await loadConfig();
await extract(resolved);
await translate(resolved, { provider: myCustomProvider });

const result = await check(resolved);
if (!result.ok) process.exit(1);
```

The programmatic API is the only way to use a `name: 'custom'` provider — custom
providers are functions and don't survive JSON serialization.

## Catalog layout

```
.translations/
├── en.json              # source-locale catalog (config.source)
├── es.json, fr.json, …  # target catalogs (config.targets)
├── .meta.json           # per-key context, description, occurrences
└── .cache/
    └── <16-hex>.json    # per-(source, target, provider) cache
```
