# Architecture

autotranslate is a translation **toolchain**, not a runtime library with an
extraction afterthought. The same data model flows from source code ->
translation files -> typed runtime, with each stage validated.

## Design principles

1. **Code is the source of truth.** Keys derive from your source - string
   literals for `useT`, structural hash for `<T>`. You never hand-author a JSON
   catalog.
2. **Self-hosted by default.** No proprietary cloud, no required CDN. Catalogs
   are JSON in your repo.
3. **Provider-agnostic.** AI providers via the Vercel AI SDK; classic MT (DeepL,
   Google) for short, high-confidence strings; bring-your-own `translateFn` for
   anything else.
4. **Framework-pluggable.** Core has zero React, zero Node-fs assumptions.
   Adapters live in their own packages.
5. **Strict type-safety end to end.** Locale unions, message-key narrowing, and
   ICU param inference are codegenned - using a key the catalog doesn't have is
   a TypeScript error.
6. **Edge-runtime friendly.** Runtime works on Vercel Edge, Cloudflare Workers,
   and Bun. Filesystem access is gated to CLI / build time only.
7. **Plugin-owned pipeline.** The framework plugin - not the user - drives
   extract -> translate -> generateTypes in development, and the frozen-check at
   build time. The CLI commands are the scripting and CI surface.

## Packages

| Package                            | Role                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `@autotranslate/core`              | Runtime translator, ICU formatter, config schema, chunking, hashing, types           |
| `@autotranslate/react`             | `<T>`, `useT`, `TranslationProvider`, `<Plural>`, `<Branch>`, formatters             |
| `@autotranslate/next`              | `withAutotranslate` plugin, `getT`, `createNextMiddleware`, RSC helpers              |
| `@autotranslate/vite`              | Vite plugin, virtual catalog module (`virtual:autotranslate`), HMR                   |
| `@autotranslate/cli`               | Engine: extract, translate, check, parity, generateTypes, createDevLoop, checkFrozen |
| `@autotranslate/providers`         | AI / DeepL / Google / stub / custom / hybrid provider adapters                       |
| `@autotranslate/eslint-plugin`     | `no-untranslated-jsx`, `no-dynamic-key`, `valid-icu-format` lint rules               |
| `@autotranslate/zod`               | Zod v4 translated validation errors                                                  |
| `@autotranslate/typescript-plugin` | TS Language Service plugin - inlay hints for `t('...')` call sites                   |

Dependencies flow downward only. `@autotranslate/core` has no workspace deps.

## Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│  Apps                                                                │
│  └─ examples/next-app, examples/vite-react                           │
├──────────────────────────────────────────────────────────────────────┤
│  Framework adapters                                                  │
│  ├─ @autotranslate/react  (T, useT, Provider, formatters)            │
│  ├─ @autotranslate/next   (plugin, proxy, getT, auto-loader)         │
│  └─ @autotranslate/vite   (virtual module, HMR, dev loop)            │
├──────────────────────────────────────────────────────────────────────┤
│  Tooling                                                             │
│  ├─ @autotranslate/cli           (engine: extract, translate,        │
│  │                                check, parity, dev-loop,           │
│  │                                auto-transform, catalog-module)     │
│  ├─ @autotranslate/providers     (AI / DeepL / Google / custom)      │
│  ├─ @autotranslate/eslint-plugin (lint rules + shared classifier)    │
│  ├─ @autotranslate/typescript-plugin (TS Language Service)           │
│  └─ @autotranslate/zod           (Zod v4 validation errors)          │
├──────────────────────────────────────────────────────────────────────┤
│  Core                                                                │
│  └─ @autotranslate/core                                              │
│     ├─ config schema (Zod) — packages/core/src/config.ts             │
│     ├─ runtime translator (WIRE_FORMAT_VERSION 2)                    │
│     ├─ ICU MessageFormat parser/formatter                            │
│     ├─ locale resolution (BCP-47, CLDR plurals, RTL)                 │
│     ├─ JSX tree (de)serialization — packages/core/src/jsx-tree.ts   │
│     ├─ content hashing (SHA-256, 12-hex prefix)                      │
│     ├─ chunking — packages/core/src/chunking.ts                      │
│     └─ classifier — packages/core/src/classifier.ts                  │
└──────────────────────────────────────────────────────────────────────┘
```

## Data flow

### 1. Authoring

```tsx
// src/components/Welcome.tsx
import { T, useT, Var } from '@autotranslate/react';

export function Welcome({ name }: { name: string }) {
  const t = useT();
  return (
    <>
      <T>
        Hello, <Var>{name}</Var>!
      </T>
      <button>{t('Sign out')}</button>
    </>
  );
}
```

### 2. Extraction

`packages/cli/src/commands/extract/` uses `@babel/parser` + `@babel/traverse` to
find:

- `<T>` JSX trees - serialized to a canonical structure, hashed to `t.<12-hex>`
  (structural key)
- `t('...')` calls bound to `useT()` - string literals captured, hashed to
  `<12-hex>` (source key)
- `t(variable)` / dynamic `<T>{variable}</T>` - flagged by the ESLint plugin

In `mode: 'auto'`, each source file is piped through `transformAutoWrap`
(`packages/cli/src/auto-transform.ts`) before extraction, so the extracted keys
match the compiler's output exactly.

Output written per run:

- `<outDir>/<source>/<bucket>.json` - hash-bucketed chunk files for the source
  locale (one file per non-empty bucket, e.g. `en/0.json` through `en/f.json` at
  `chunkBits: 4`)
- `<outDir>/.meta.json` - per-key context, description, occurrences
- `<outDir>/index.ts` - the generated catalog module (static `import()`
  specifiers per existing bucket file, regenerated idempotently)

### 3. Translation

For each target locale, `packages/cli/src/commands/translate.ts`:

1. Loads the cache
   (`.translations/.cache/<provider-sig>/<source-target>/<chunk>.json`).
2. Computes a delta: keys missing or whose source-content hash changed.
3. Applies per-locale `overrides` from the config.
4. Batches the rest to the configured provider (`config.concurrency` controls
   parallelism, max 64).
5. Writes `<outDir>/<locale>/<bucket>.json` for each affected bucket and updates
   the cache.
6. Regenerates `<outDir>/index.ts` (idempotent - skipped when content is
   unchanged to avoid HMR churn).

Cache key = `sha256(source + target + providerSignature)`. Identical inputs
never re-translate.

### 4. Type generation

`autotranslate generate-types` (or the dev loop) emits `<outDir>/types.d.ts`
that augments `@autotranslate/core`:

```ts
declare module '@autotranslate/core' {
  interface AutotranslateCatalog {
    'Sign out': true;
    'Hello, {name}!': true;
    't.abc123': true;
  }
}
```

`useT()` autocompletes the catalog and rejects unknown keys as TypeScript
errors.

### 5. Runtime delivery - the generated catalog module

`<outDir>/index.ts` is the catalog delivery mechanism. It uses static `import()`
specifiers for every existing bucket file so bundlers can code-split per locale
at build time:

```ts
// .translations/index.ts - GENERATED. Do not edit.
import type { Catalog, Locale } from '@autotranslate/core';

export const source = 'en' as const;
export const locales = ['en', 'es', 'fr', 'ja'] as const;

const chunks: Record<
  string,
  ReadonlyArray<() => Promise<{ default: Catalog }>>
> = {
  en: [() => import('./en/0.json'), () => import('./en/f.json') /* ... */],
  es: [() => import('./es/0.json'), () => import('./es/f.json') /* ... */],
};

export async function loadCatalog(locale: Locale): Promise<Catalog> {
  const parts = await Promise.all((chunks[locale] ?? []).map((load) => load()));
  return Object.assign({}, ...parts.map((m) => m.default));
}
```

**Next.js / RSC** - `import * as catalogModule from '../../.translations'` pulls
in the generated module. Pass it to `getT(lang, { module: catalogModule })` or
call `catalogModule.loadCatalog(lang)` directly in the layout. Webpack and
Turbopack code-split per locale from the static import calls. No runtime
filesystem access; no `outputFileTracingIncludes` wiring needed.

**Vite** - `@autotranslate/vite` serves a virtual module
(`virtual:autotranslate`) backed by the same catalog data. The plugin watches
`<outDir>/<locale>/**/*.json` and triggers HMR on changes. `configureServer`
reads the on-disk JSON files through `packages/vite/src/load-catalogs.ts`.

**Edge runtimes** - catalogs are resolved at bundle time. No filesystem access
at request time. Works on Vercel Edge, Cloudflare Workers, and Bun with zero
extra configuration.

**Custom sources** - pass a `load` callback to `getT` for KV, Edge Config, or
any other catalog store.

### 6. Dev loop

`createDevLoop` (`packages/cli/src/dev-loop.ts`) is a persistent file watcher
that drives the pipeline on each source-file change:

- Uses chokidar v4 to watch the static directory prefixes extracted from
  `config.content` globs.
- Debounces 150ms; serializes runs (one trailing run queued while in-progress).
- Each run: extract -> translate delta -> generateTypes.
- Provider / config errors emit as `{ type: 'error' }` events - watching
  continues, the dev server never crashes.

`withAutotranslate` (`packages/next/src/plugin.ts`) starts the loop on
`phase-development-server` via a `Symbol.for('autotranslate.devLoop')` guard on
`globalThis` (safe across Next.js's multiple config evaluations).

`@autotranslate/vite` (`packages/vite/src/index.ts`) starts it in the
`configureServer` hook.

Both plugins import `@autotranslate/cli` as an optional peer: if it is absent
they warn once and continue without the dev loop or frozen check.

### 7. Frozen build check

`checkFrozen` (`packages/cli/src/commands/check-frozen.ts`) re-extracts in
memory and compares against the committed catalog:

- `catalogAbsent: true` - the source locale directory does not exist; return
  `ok: true` (fresh project or example app - never fail).
- `missingSource` - keys in the live AST not found in the committed catalog,
  with `file:line` occurrence and source text.
- `problems` - target-locale issues from `check()` (missing / orphan /
  invalid-ICU).

`formatFrozenReport(report)` produces a human-readable failure string.

`withAutotranslate` calls `checkFrozen` on `phase-production-build` and throws
on failure. `@autotranslate/vite` calls it in `buildStart`. The model is never
called at build time. CI needs no API key.

`build.translateOnBuild: true` in the config causes the build to translate
missing strings before re-checking - useful for automated deploy pipelines.

## Chunking

`packages/core/src/chunking.ts` defines two exports used throughout the
pipeline:

**`bucketFor(key, chunkBits)`** - maps a key to its bucket filename. Strips the
`t.` structural-key prefix, then reads the first `max(1, ceil(chunkBits / 4))`
hex characters of the hash. At the default `chunkBits: 4`, that is 1 hex
character: `0` through `f`.

**`buildChunkLayout(manifest, options)`** - groups all keys in the manifest into
a `Map<bucketName, keys[]>`, alphabetized within each bucket for stable diffs
across runs.

Both the CLI (extraction and translation writers) and the generated `index.ts`
builder (`packages/cli/src/catalog-module.ts`) use the bucket names produced by
these functions, ensuring a key always resolves to the same file path across
every locale.

## Auto mode

`mode: 'auto'` in `autotranslate.config.ts` activates compile-time JSX wrapping
via `transformAutoWrap` (`packages/cli/src/auto-transform.ts`):

- Wraps qualifying contiguous JSX text runs in `<T>`, turning embedded `{expr}`
  into `<Var>{expr}</Var>`.
- In client modules (`"use client"`), rewrites the positive set of user-facing
  host attributes (`title`, `placeholder`, `alt`, `label`, `aria-label`,
  `aria-description`, `aria-placeholder`, `aria-roledescription`, and
  `aria-valuetext`) and injects or reuses a `const t = useT()` binding in the
  enclosing component or hook. Unknown HTML, SVG, ARIA, React, and library
  attributes are structural by default and stay byte-identical. `useT()` is a
  client hook, so server-component attributes are left for the lint rule;
  custom-component copy props are left to the component.
- Skips `code`, `pre`, `script`, `style` elements and anything with
  `data-no-translate` on self or a JSX ancestor.
- Adds `import { T, Var, useT } from '@autotranslate/react'` as needed.

The shared classifier (`packages/core/src/classifier.ts`) defines
`TRANSLATION_MARKERS`, `SKIP_ELEMENTS`, `jsxTextHasContent`,
`NO_TRANSLATE_ATTRIBUTE`, and `isTranslatableAttribute` (a positive set of
user-facing host attributes). Both the ESLint plugin and the compiler import
from this module - what the linter flags is exactly what `mode: 'auto'` would
wrap.

Bundler wiring (done by the plugins, not the CLI):

- **Next.js** - `withAutotranslate` registers `@autotranslate/next/auto-loader`
  for `*.{jsx,tsx}` via webpack `module.rules` and turbopack `rules`.
- **Vite** - the `transform` hook in `@autotranslate/vite` calls
  `transformAutoWrap` directly.

In `mode: 'auto'`, the extractor also pipes each source file through
`transformAutoWrap` before running extraction, so the committed catalog keys
match the compiler's output exactly by construction.

## Comparison: code-first AI i18n

| Concern         | gt-next / gt-react    | autotranslate                                                 |
| --------------- | --------------------- | ------------------------------------------------------------- |
| Source of truth | code (`<T>Hello</T>`) | code (`<T>` + `useT('Hello')`)                                |
| Translation     | cloud-side            | self-hosted, committed to repo                                |
| Framework reach | React / Next          | React / Next / Vite / edge                                    |
| AI provider     | proprietary           | Vercel AI SDK + DeepL + Google + custom                       |
| Catalog format  | hashed JSON via API   | `.translations/*.json` (in-repo)                              |
| Type generation | partial               | first-class                                                   |
| Edge runtime    | partial               | yes                                                           |
| Pipeline owner  | cloud                 | framework plugin (`withAutotranslate`, `@autotranslate/vite`) |
| CI API key      | required              | not required                                                  |

See [`ROADMAP.md`](ROADMAP.md) for the milestone plan.
