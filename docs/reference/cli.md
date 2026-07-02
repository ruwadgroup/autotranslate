# CLI reference

```bash
npx autotranslate <command> [flags]
```

The CLI auto-discovers `autotranslate.config.{ts,mts,js,mjs}` from the current
directory.

> **Relationship to the framework plugins.** The framework plugins
> (`withAutotranslate`, `@autotranslate/vite`) own the pipeline in normal use -
> they start the dev loop and run the frozen check automatically. The CLI is the
> scripting and CI surface: run individual steps, inspect the catalog, or use
> the programmatic API from `@autotranslate/cli` in custom tooling.

## `init`

Scaffold autotranslate for the current project (non-interactive, idempotent).

```bash
npx autotranslate init
npx autotranslate init --framework vite --targets es,fr,ja --provider anthropic
```

Steps performed (each reports `done`, `already configured`, or `skipped` with a
printed manual diff):

1. Write `autotranslate.config.ts`
2. **Next**: AST-wrap the default export of `next.config.{ts,mjs,js}` in
   `withAutotranslate`; print a manual diff when the export shape is
   unrecognised
3. **Next**: create `proxy.ts` (locale routing) if absent
4. **Vite**: print a one-line manual diff for `vite.config.ts`
5. Add `".translations/types.d.ts"` to `tsconfig.json` `include`
6. Append `.translations/.cache/` to `.gitignore`
7. Print a manual diff for `app/[lang]/layout.tsx` (never edited automatically)

| Flag          | Default     | Description                                         |
| ------------- | ----------- | --------------------------------------------------- |
| `--framework` | auto-detect | `next` or `vite`                                    |
| `--targets`   | `es,fr,ja`  | Comma-separated target locales                      |
| `--provider`  | `anthropic` | `anthropic`, `openai`, `google`, `deepl`, or `stub` |
| `--force`     | `false`     | Overwrite existing `autotranslate.config.ts`        |

Re-running is safe - every step is idempotent.

## `extract`

Scan source files matched by `config.content` and write the source-locale
catalog.

```bash
npx autotranslate extract
```

Output:

- `<outDir>/<source>/*.json` - canonical source catalog chunks
- `<outDir>/.meta.json` - per-key context, description, occurrences
- `<outDir>/index.ts` - generated catalog module (updated when bucket set or
  locale set changes)

The extractor recognises:

- **`<T>...</T>`** - children linearised to a `StructuredMessage` and hashed via
  the canonical-key derivation. Key is `t.<12-hex>`.
- **`useT()` literal calls** - `t('literal')` where `t` is bound to a `useT()`
  invocation in the same file.
- **Standalone `t()`** - `t('literal')` where `t` is imported from
  `@autotranslate/core/t` (or `/standalone`).

When `mode: 'auto'` is set in the config, each source file is piped through
`transformAutoWrap` before extraction so the extracted keys match the compiled
output key-for-key.

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

1. Load the per-(source, target, provider-signature, chunk) cache from
   `<outDir>/.cache/<provider-sig>/<source-target>/<chunk>.json`.
2. Compute a delta - keys missing or whose source-content hash changed.
3. Apply per-locale overrides from `config.overrides`.
4. Send what's left to the configured provider.
5. Write `<outDir>/<target>/*.json`, update the cache, and regenerate
   `<outDir>/index.ts`.

Cache key includes the provider's `signature` (e.g.
`ai:anthropic:claude-haiku-4-5`), so switching models invalidates stale entries
automatically.

## `generate-types`

Emit a `.d.ts` that augments `@autotranslate/core`'s `AutotranslateCatalog`
interface with the literal key set.

```bash
npx autotranslate generate-types
```

Output: `<outDir>/types.d.ts`. Reference it from your `tsconfig.json` (init does
this automatically):

```jsonc
{
  "include": ["src", ".translations/types.d.ts"],
}
```

After generation, `useT('Sing out')` is a TypeScript error. The `(string & {})`
arm in the type preserves autocomplete without tightening compile errors when
the typegen has not run yet.

See [Type safety](../guides/typesafety.md).

## `check`

Verify catalog parity. Suitable for CI and scripting.

```bash
npx autotranslate check
```

Reports three kinds of problem:

- **`missing`** - source key absent from a target locale
- **`orphan`** - target key no longer in source
- **`invalid-icu`** - string entry that does not parse as ICU MessageFormat

Exits non-zero on any problem.

> In normal use the framework plugin's frozen-build check (`checkFrozen`) is
> more useful than `check` in CI, because it also catches uncommitted source
> strings before the build fails. Use `check` for scripting or post-translate
> verification.

## `parity`

Diff catalogs against a base git ref and report locale parity. Designed for PR
review workflows.

```bash
npx autotranslate parity
npx autotranslate parity --base origin/main --format github
```

| Flag             | Default       | Description                                      |
| ---------------- | ------------- | ------------------------------------------------ |
| `--base <ref>`   | `origin/main` | Git ref to diff against                          |
| `--format <fmt>` | `text`        | `text` for terminal, `github` for Markdown table |

`--format github` emits a Markdown table (capped at 50 rows with a "+N more"
line) suitable for posting as a PR comment. Exit code 1 when parity fails
(missing keys, orphans, invalid ICU); 0 when all added strings are fully
translated.

See the full recipe in [PR parity](../cookbook/pr-parity.md).

## `find`

Look up a catalog key by its 12-hex hash. Useful for debugging what a hash
resolves to.

```bash
npx autotranslate find 9f3a1c2b4d5e
```

Prints the source string, context, description, and every recorded call site.

## Programmatic API

Every command is also a function under `@autotranslate/cli`:

```ts
import {
  check,
  checkFrozen,
  createDevLoop,
  extract,
  formatFrozenReport,
  generateTypes,
  init,
  loadConfig,
  parity,
  translate,
} from '@autotranslate/cli';

const resolved = await loadConfig();
await extract(resolved);
await translate(resolved, { provider: myCustomProvider });

// Frozen check (what the build plugin runs)
const report = await checkFrozen(resolved);
if (!report.ok && !report.catalogAbsent) {
  throw new Error(formatFrozenReport(report));
}

// Dev loop (what withAutotranslate and @autotranslate/vite run in dev)
const loop = createDevLoop({
  cwd: process.cwd(),
  onEvent: (e) => console.log(e),
});
// later:
await loop.close();
```

The programmatic API is the only way to use a `name: 'custom'` provider.

## Exit codes

| Code | Meaning                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------ |
| `0`  | Success.                                                                                         |
| `1`  | Command failed, including config/provider errors, `check` parity problems, or `parity` failures. |

Set `DEBUG=*` to print the full error stack on failure.
