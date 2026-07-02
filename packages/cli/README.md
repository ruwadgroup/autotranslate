# @autotranslate/cli

The `autotranslate` command and programmatic pipeline engine. Framework plugins
(`@autotranslate/next`, `@autotranslate/vite`) drive this automatically; these
commands are the scripting and CI surface.

```bash
pnpm add -D @autotranslate/cli
npx autotranslate init
```

## Commands

### `autotranslate init`

Detects your framework from `package.json`, writes `autotranslate.config.ts`,
wraps `next.config.ts` with `withAutotranslate` (AST edit), creates `proxy.ts`,
adds `.translations/types.d.ts` to `tsconfig.json`, and gitignores
`.translations/.cache/`. Pass `--force` to overwrite an existing config.
Re-running is safe - every step reports `done`, `already configured`, or
`skipped` with a manual diff.

```bash
npx autotranslate init
npx autotranslate init --framework vite
npx autotranslate init --targets es,fr,ja
npx autotranslate init --provider anthropic
```

### `autotranslate extract`

Scans `config.content` globs, parses every `.ts`/`.tsx` file, and writes the
source-locale catalog as hash-bucketed chunks under `<outDir>/<source>/` plus
per-key metadata to `<outDir>/.meta.json`. Also regenerates `<outDir>/index.ts`
(the catalog module) and `<outDir>/types.d.ts`.

Two patterns are extracted:

- **`<T>...</T>`** - children are walked to a `StructuredMessage` and hashed via
  `canonicalKey`.
- **`useT()` literal calls** - `t('literal')` where `t` comes from `useT()`; the
  literal is both key and source text.

### `autotranslate translate`

Translates the source catalog into every target locale. Delta-only: skips keys
whose source-content hash matches the cache. Applies per-locale `overrides` from
config.

```bash
npx autotranslate translate
npx autotranslate translate --locale es fr   # subset
```

### `autotranslate generate-types`

Reads the source catalog and emits `<outDir>/types.d.ts`, which augments
`@autotranslate/core`'s `AutotranslateCatalog` interface with the literal key
set. `useT` and `t` then autocomplete and reject unknown keys.

### `autotranslate check`

Verifies catalog parity across all target locales. Reports **missing** keys,
**orphan** keys, and **invalid-icu** strings. Exits non-zero on problems - wire
into CI.

### `autotranslate parity`

Diffs the current catalog against a base ref (default `origin/main`).

```bash
npx autotranslate parity
npx autotranslate parity --format github    # Markdown table for PR comments
```

Exits non-zero when strings are missing, orphaned, or have invalid ICU.

## Programmatic API

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
  writeCatalogModule,
} from '@autotranslate/cli';

const resolved = await loadConfig();

await extract(resolved); // writes chunks + index.ts
await translate(resolved); // writes target chunks + index.ts
await generateTypes(resolved); // writes types.d.ts

// Frozen check (what the build plugin runs)
const report = await checkFrozen(resolved);
if (!report.ok && !report.catalogAbsent) {
  throw new Error(formatFrozenReport(report));
}

// Dev loop (what withAutotranslate and @autotranslate/vite run in dev)
const loop = createDevLoop({
  cwd: process.cwd(),
  onEvent: (e) => {
    if (e.type === 'error') console.warn(e.error);
    if (e.type === 'run-complete')
      console.log('translated', e.extract.fileCount, 'files');
  },
});
await loop.close();
```

The programmatic API is the only way to use a `name: 'custom'` provider - custom
providers are functions and can't survive JSON serialization.

## Catalog layout

```
.translations/
├── en/                    # source-locale, hash-bucketed chunks
│   ├── 0.json
│   ├── ...
│   └── f.json
├── es/                    # target locales, same bucket structure
│   ├── 0.json
│   └── ...
├── fr/
├── ja/
├── index.ts               # generated catalog module (static import()s, bundler entry)
├── .meta.json             # per-key context, description, occurrences
└── .cache/
    └── <provider-sig>/<source-target>/<chunk>.json
```

Commit `.translations/` to your repo (except `.cache/`). Treat it like a
lockfile - the build verifies it on every CI run.
