# CLI Reference

```bash
npx autotranslate <command> [flags]
```

The CLI auto-discovers `autotranslate.config.{ts,mts,js,mjs}` from the current
directory.

## `init`

Scaffold `autotranslate.config.ts` in the current directory.

```bash
npx autotranslate init
```

| Flag      | Default | Description                        |
| --------- | ------- | ---------------------------------- |
| `--force` | `false` | Overwrite an existing config file. |

No-op if the config already exists (unless `--force` is passed).

## `extract`

Scan source files matched by `config.content` and build the canonical
source-locale catalog.

```bash
npx autotranslate extract
```

Output:

- `<outDir>/<source>.json` — canonical source catalog
- `<outDir>/.meta.json` — per-key context, description, occurrences

The extractor recognizes two patterns:

- **`<T>...</T>`** — children are linearized to a `StructuredMessage` and hashed
  via `canonicalKey`. The key is `t.<12-hex>`.
- **`useT()` literal calls** — `t('literal')` where `t` is bound to a `useT()`
  invocation in the same file. The literal becomes the key.

Whitespace handling matches React's JSX runtime, so the canonical key is
identical at extract and render time.

## `translate`

Translate the source catalog into every target locale.

```bash
npx autotranslate translate
npx autotranslate translate --locale es fr
```

| Flag                    | Default | Description                             |
| ----------------------- | ------- | --------------------------------------- |
| `-l`, `--locale <list>` | all     | Restrict to a subset of target locales. |

For each target:

1. Load the per-(source, target, provider-signature) cache from
   `<outDir>/.cache/<sig>.json`.
2. Compute a delta — keys missing or whose source-content hash changed.
3. Apply per-locale overrides from `config.overrides`.
4. Send what's left to the configured provider.
5. Write `<outDir>/<target>.json` and update the cache.

Cache key includes the provider's `signature` (e.g.
`ai:anthropic:claude-haiku-4-5`), so switching models invalidates stale entries
automatically.

## `generate-types`

Emit a `.d.ts` that augments `@autotranslate/react`'s `AutotranslateCatalog`
interface with the literal key set.

```bash
npx autotranslate generate-types
```

Output: `<outDir>/types.d.ts`. Reference it from your `tsconfig.json`:

```jsonc
{
  "include": ["src", ".translations/types.d.ts"],
}
```

After generation, `useT('Sing out')` is a TypeScript error. The `(string & {})`
arm in `CatalogKey` keeps autocomplete on without tightening compile errors when
the typegen hasn't run yet.

See the [type-safety guide](guides/type-safety.md) for the full flow.

## `check`

Verify catalog parity. Suitable for CI.

```bash
npx autotranslate check
```

Reports three kinds of problem:

- **`missing`** — source key absent from a target locale
- **`orphan`** — target key no longer in source
- **`invalid-icu`** — string entry that doesn't parse as ICU MessageFormat

Exits non-zero on any problem.

## Programmatic API

Every command is also a function under `@autotranslate/cli`:

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

## Exit codes

| Code | Meaning                                                 |
| ---- | ------------------------------------------------------- |
| `0`  | Success.                                                |
| `1`  | Generic failure (missing config, provider error, etc.). |
| `1`  | `check` found one or more problems.                     |

Set `DEBUG=*` (or any truthy `DEBUG` value) to print the full error stack on
failure.
