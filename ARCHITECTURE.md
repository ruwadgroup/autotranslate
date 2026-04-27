# Architecture

autotranslate is a translation **toolchain**, not a runtime library with an
extraction afterthought. The same data model flows from source code →
translation files → typed runtime, with each stage validated.

## Design principles

1. **Code is the source of truth.** Keys derive from your source — string
   literals for `useT`, structural hash for `<T>`. You never hand-author a JSON
   catalog.
2. **Self-hosted by default.** No proprietary cloud, no required CDN. Catalogs
   are JSON in your repo (or wherever you persist them).
3. **Provider-agnostic.** AI providers via the Vercel AI SDK; classic MT (DeepL,
   Google) for short, high-confidence strings; bring-your-own `translateFn` for
   anything else.
4. **Framework-pluggable.** Core has zero React, zero Node-fs assumptions.
   Adapters live in their own packages.
5. **Strict type-safety end to end.** Locale unions, message-key narrowing, and
   ICU param inference are codegenned — using a key the catalog doesn't have is
   a TypeScript error.
6. **Edge-runtime friendly.** Runtime works on Vercel Edge, Cloudflare Workers,
   and Bun. Filesystem access is gated to CLI / build time only.

## Layers

```
┌──────────────────────────────────────────────────────────────────┐
│  Apps                                                            │
│  └─ examples/next-app, examples/vite-react                       │
├──────────────────────────────────────────────────────────────────┤
│  Framework adapters                                              │
│  ├─ @autotranslate/react  (T, useT, Provider, RSC helpers)       │
│  ├─ @autotranslate/next   (plugin, proxy, getT)                  │
│  └─ @autotranslate/vite   (virtual modules, HMR)                 │
├──────────────────────────────────────────────────────────────────┤
│  Tooling                                                         │
│  ├─ @autotranslate/cli           (extract, translate, check)     │
│  ├─ @autotranslate/eslint-plugin (lint rules)                    │
│  └─ @autotranslate/mcp           (agentic clients)               │
├──────────────────────────────────────────────────────────────────┤
│  Providers                                                       │
│  └─ @autotranslate/providers (ai, deepl, google, stub, custom)   │
├──────────────────────────────────────────────────────────────────┤
│  Core                                                            │
│  └─ @autotranslate/core                                          │
│     ├─ config schema (Zod)                                       │
│     ├─ runtime translator                                        │
│     ├─ ICU MessageFormat parser/formatter                        │
│     ├─ locale resolution (BCP-47, CLDR plurals, RTL)             │
│     ├─ JSX tree (de)serialization                                │
│     └─ content hashing (SHA-256)                                 │
└──────────────────────────────────────────────────────────────────┘
```

Dependencies flow downward only. `@autotranslate/core` has no workspace deps.

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

`@autotranslate/cli`'s extractor uses `@babel/parser` + `@babel/traverse` to
find:

- `<T>` JSX trees → serialized to a canonical structure, hashed
- `t('...')` calls bound to `useT()` → string literals captured
- `t(variable)` / dynamic `<T>{variable}</T>` → flagged via the ESLint plugin

Output: `<outDir>/<source>.json` (the canonical / source catalog) plus
`<outDir>/.meta.json` (per-key context, hints, occurrences).

### 3. Translation

For each target locale, the translator:

1. Loads the cache (`.translations/.cache/<sig>.json`).
2. Computes a delta: keys missing or whose source-content hash changed.
3. Applies per-locale `overrides` from the config.
4. Batches the rest to the configured provider.
5. Writes `<outDir>/{locale}.json` and updates the cache.

Cache key = `sha256(source + target + providerSignature)`. Identical inputs
never re-translate.

### 4. Type generation

`autotranslate generate-types` emits a `.d.ts` that augments
`@autotranslate/react`:

```ts
declare module '@autotranslate/react' {
  interface AutotranslateCatalog {
    'Sign out': true;
    'Hello, {name}!': true;
    't.abc123': true;
  }
}
```

`useT()` autocompletes the catalog and rejects unknown keys.

### 5. Runtime

- **SPAs / React Native** — catalogs are bundled (Vite plugin → virtual modules,
  Metro resolver) so `t()` is synchronous.
- **RSC / SSR** — `getT(locale)` reads the catalog from disk on the server and
  returns a translator function.
- **Edge** — catalogs are inlined or fetched from KV via a custom `load`.

The runtime translator is a pure function: `(key, params) → string`. It looks up
the catalog, resolves ICU plural / select branches, formats variables, and falls
back to source on miss.

## Comparison: code-first AI i18n

| Concern          | gt-next / gt-react    | autotranslate                           |
| ---------------- | --------------------- | --------------------------------------- |
| Source of truth  | code (`<T>Hello</T>`) | code (`<T>` + `useT('Hello')`)          |
| Translation host | cloud                 | self                                    |
| Framework reach  | React / Next          | React / Next / Vite / RN / edge         |
| AI provider      | proprietary           | Vercel AI SDK + DeepL + Google + custom |
| Catalog format   | hashed JSON via API   | `.translations/*.json` (in-repo)        |
| Type generation  | partial               | first-class                             |
| Edge runtime     | partial               | yes                                     |
| MCP server       | no                    | planned                                 |

## Open questions

Deliberately unresolved — we'll decide them as the implementation lands:

- **Compiler vs. runtime** for `<T>` — ship a Babel/SWC plugin that pre-resolves
  at build time, or stay runtime-only and rely on bundling?
- **Streaming dev mode** — translate on-demand during dev (like GT) or
  batch-only?
- **Catalog schema** — bag of keys vs. namespaced sections vs. ICU-only?

See [`ROADMAP.md`](ROADMAP.md) for the milestone plan.
