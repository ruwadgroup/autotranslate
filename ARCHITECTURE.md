# Architecture

`autotranslate` is a translation **toolchain**, not a runtime library with an
extraction afterthought. The same data model flows from source code →
translation files → typed runtime, with each stage validated.

## Design principles

1. **Code is the source of truth.** Translation keys are derived from your code
   (string content for `useT`, JSX-tree hash for `<T>`). You never hand-author a
   JSON catalog.
2. **Self-hosted by default.** No proprietary cloud, no required CDN.
   Translations are JSON files in your repo (or wherever you persist them).
3. **Provider-agnostic.** AI providers via the Vercel AI SDK; classic MT (DeepL,
   Google) for short, high-confidence strings; bring-your-own `translateFn` for
   anything else.
4. **Framework-pluggable.** Core has zero React, zero Node-fs assumptions.
   Adapters live in their own packages.
5. **Strict typesafety end-to-end.** Locale unions, message-key narrowing, and
   ICU param inference are codegenned — using a translation key the catalog
   doesn't have is a type error.
6. **Edge-runtime friendly.** Runtime works on Vercel Edge, Cloudflare Workers,
   Bun. Filesystem access is gated to CLI / build time only.

## Layers

```
┌──────────────────────────────────────────────────────────────────┐
│  Apps                                                             │
│  └─ examples/next-app, examples/vite-react                        │
├──────────────────────────────────────────────────────────────────┤
│  Framework adapters                                               │
│  ├─ @autotranslate/react   (T, useT, Provider, RSC helpers)       │
│  ├─ @autotranslate/next    (plugin, middleware, getT)             │
│  └─ @autotranslate/vite    (virtual modules, HMR)                 │
├──────────────────────────────────────────────────────────────────┤
│  Tooling                                                          │
│  ├─ @autotranslate/cli           (extract, translate, check)      │
│  ├─ @autotranslate/eslint-plugin (lint rules)                     │
│  └─ @autotranslate/mcp           (agentic clients)                │
├──────────────────────────────────────────────────────────────────┤
│  Providers                                                        │
│  └─ @autotranslate/providers (ai, deepl, google, stub, custom)    │
├──────────────────────────────────────────────────────────────────┤
│  Core                                                             │
│  └─ @autotranslate/core                                           │
│     ├─ config schema (Zod)                                        │
│     ├─ runtime translator                                         │
│     ├─ ICU MessageFormat parser/formatter                         │
│     ├─ locale resolution (BCP-47, CLDR plurals, RTL)              │
│     ├─ JSX tree (de)serialization                                 │
│     └─ content hashing (SHA-256 + gzip cache)                     │
└──────────────────────────────────────────────────────────────────┘
```

Dependencies flow downward only. `@autotranslate/core` depends on nothing in the
workspace.

## Data flow

### 1. Authoring

```tsx
// src/components/Welcome.tsx
import { T, Var, useT } from '@autotranslate/react';

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
- `t('...')` / `useT()(...)` calls → string literals captured
- `t(variable)` / dynamic `<T>{variable}</T>` → flagged via the ESLint plugin

Output: `.translations/en.json` (the canonical / source catalog) +
`.translations/.meta.json` (per-key context, hints, overrides).

### 3. Translation

For each target locale, the translator:

1. Loads the cache (`.translations/.cache/*.gz`).
2. Computes a delta: keys missing or changed since last run.
3. Batches the delta to the configured provider.
4. Applies per-key overrides from `.meta.json`.
5. Writes `.translations/{locale}.json` and updates the cache.

Cache key = `sha256(content + sourceLocale + targetLocale + providerSig)`.
Identical inputs never re-translate.

### 4. Type generation

`autotranslate generate-types` emits:

```ts
// .translations/.types.ts
export type AutotranslateLocale = 'en' | 'es' | 'fr' | 'ja';
export type AutotranslateMessageKey = 'Sign out' | 'Hello, {name}!' | …;
```

Imported by `@autotranslate/react` to give `useT()` literal-type narrowing on
its argument.

### 5. Runtime

- **SPAs / React Native:** catalogs are bundled (Vite plugin → virtual modules;
  Metro resolver) so `t()` is synchronous.
- **RSC / SSR:** `getT(locale)` reads the catalog from disk on the server,
  returns a translator function.
- **Edge:** catalogs are inlined or fetched from a KV store via the
  `provider.runtime` config.

The runtime translator is a pure function:
`(key, params) → translated string | JSX`. It looks up the catalog, resolves ICU
plural/select branches, formats variables, and falls back to source on miss.

## Comparison: General Translation

| Concern          | gt-next/gt-react      | autotranslate                           |
| ---------------- | --------------------- | --------------------------------------- |
| Source of truth  | code (`<T>Hello</T>`) | code (`<T>` and `useT('Hello')`)        |
| Translation host | cloud                 | self                                    |
| Framework reach  | React/Next            | React/Next/Vite/RN/edge                 |
| AI provider      | proprietary           | Vercel AI SDK + DeepL + Google + custom |
| Catalog format   | hashed JSON via API   | `.translations/*.json` (in-repo)        |
| Type generation  | partial               | first-class                             |
| Edge runtime     | partial               | yes                                     |
| MCP server       | no                    | yes                                     |

## Open questions

These are deliberately unresolved — we'll decide them in the implementation
phase:

- **JSX-tree hashing:** mirror General Translation's structural hash (lets us
  survive whitespace tweaks) vs. a stable `id` prop?
- **Compiler vs. runtime** for `<T>` — ship a Babel/SWC plugin that pre-resolves
  at build time, or stay runtime-only and rely on bundling?
- **Catalog schema:** bag of keys vs. namespaced sections vs. ICU-only?
- **Streaming dev mode:** translate on-demand during dev (like GT) or
  batch-only?

See [`ROADMAP.md`](ROADMAP.md) for the milestone plan.
