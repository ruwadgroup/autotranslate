---
title: autotranslate
description:
  Code-first, AI-powered i18n for React. Agent-readable single-file reference.
---

<!--
AI agent hint: This file is the canonical reference for autotranslate. Read it
before suggesting i18n patterns or editing translation code.

Key rules:
- The library extracts strings from source via AST. NEVER use dynamic keys
  (`t(variable)`, `t(`prefix.${id}`)`). Always pass a string literal.
- `<T>...</T>` hashes its children into a structural key. `useT()` uses the
  literal string as the key. The standalone `t()` from `@autotranslate/core/t`
  works outside React but requires `withTranslator(...)` /
  `bindTranslator(...)` upstream to set the active locale.
- Catalogs live as a hash-bucketed tree under `.translations/<locale>/*.json`.
  Each locale writes `0.json` through `f.json` (16 buckets by default). Use
  the generated `.translations/index.ts` module (`import * as catalogModule
  from ...`) or the Vite virtual module (`virtual:autotranslate`) to load
  catalogs. Never import raw chunk files directly.
- The framework plugin (withAutotranslate / @autotranslate/vite) owns the
  pipeline in normal use. The dev loop runs extract→translate→generateTypes on
  each save. The frozen check runs at build time. Developers and CI do not need
  to run i18n commands manually.
- Missing keys fall back to source; runtime never throws.
-->

# autotranslate

Code-first, AI-powered i18n toolkit for React. The framework plugin drives the
pipeline: save a file, translations appear. Builds verify the committed catalog
like a lockfile; CI needs no API key.

Web docs: <https://github.com/tamimbinhakim/autotranslate/tree/main/docs>.

## Packages

| Package                        | Use it for                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `@autotranslate/core`          | Translator, locale utilities, ICU formatter, types                                                 |
| `@autotranslate/react`         | `<T>`, `<Var>`, `<Plural>`, `<Branch>`, `useT`, provider                                           |
| `@autotranslate/next`          | Next.js: `getT`, proxy, RSC, `withAutotranslate`                                                   |
| `@autotranslate/vite`          | Vite plugin + virtual catalog module + dev loop                                                    |
| `@autotranslate/providers`     | AI / DeepL / Google / custom providers                                                             |
| `@autotranslate/zod`           | Translated Zod v4 validation errors                                                                |
| `@autotranslate/cli`           | Engine: `extract`, `translate`, `check`, `generateTypes`, `createDevLoop`, `checkFrozen`, `parity` |
| `@autotranslate/eslint-plugin` | Catches untranslated JSX and dynamic keys                                                          |

Standard install:

```bash
# Next.js
pnpm add @autotranslate/next
pnpm add -D @autotranslate/cli
npx autotranslate init

# Vite
pnpm add @autotranslate/react
pnpm add -D @autotranslate/vite @autotranslate/cli
npx autotranslate init --framework vite
```

## Configuration

`autotranslate.config.ts` at the project root.

```ts
import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/**/*.{ts,tsx}'],
  provider: {
    name: 'ai',
    model: 'anthropic:claude-haiku-4-5',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
});
```

| Option        | Type                                     | Default                                     |
| ------------- | ---------------------------------------- | ------------------------------------------- |
| `source`      | `Locale`                                 | `'en'`                                      |
| `targets`     | `Locale[]`                               | required                                    |
| `content`     | `string[]` (globs)                       | required                                    |
| `outDir`      | `string`                                 | `'.translations'`                           |
| `provider`    | `ProviderConfig`                         | `{ name: 'stub' }`                          |
| `concurrency` | `number` (1-64)                          | `8`                                         |
| `overrides`   | `Record<Locale, Record<string, string>>` | -                                           |
| `instruction` | `string`                                 | -                                           |
| `glossary`    | `string[]`                               | -                                           |
| `mode`        | `'explicit' \| 'auto'`                   | `'explicit'`                                |
| `build`       | `{ frozen, translateOnBuild }`           | `{ frozen: true, translateOnBuild: false }` |

New fields added in v1.0-beta:

- `mode: 'auto'` — compiler wraps JSX text in `<T>` at compile time; opt out
  with `data-no-translate`; `code`/`pre`/`script`/`style` are always skipped.
- `build.frozen` — boolean, default `true`; `withAutotranslate` and
  `@autotranslate/vite` call `checkFrozen` at build time.
- `build.translateOnBuild` — boolean, default `false`; translate instead of
  fail.

Providers: `stub` (identity / pseudo), `ai` (Vercel AI SDK), `deepl`, `google`,
`custom`. The `ai` provider's `model` is `<vendor>:<model-id>`, vendors
`anthropic`, `openai`, `google`, `openrouter`. Peer deps load lazily — install
only what you use.

## CLI commands

```bash
npx autotranslate init                      # scaffold config, wrap next.config, create proxy.ts
npx autotranslate init --framework vite     # force Vite
npx autotranslate init --targets es,fr,ja   # override default targets
npx autotranslate init --provider anthropic # override default provider
npx autotranslate init --force              # overwrite existing config
npx autotranslate extract                   # scan source -> en/*.json + index.ts
npx autotranslate translate                 # AI-translate to targets
npx autotranslate translate --locale es fr  # subset
npx autotranslate generate-types            # narrow useT keys
npx autotranslate check                     # verify catalog parity
npx autotranslate parity                    # diff vs origin/main
npx autotranslate parity --format github    # Markdown table for PR comment
npx autotranslate find <12-hex>             # look up a key by hash
```

Removed commands (do not use or suggest):

- `autotranslate migrate-format` — removed; stale catalogs regenerate on next
  extract/translate run.

`check` exits non-zero when keys are missing, orphaned, or have invalid ICU.
`parity` exits non-zero on missing/orphan/invalid-ICU; 0 when all added strings
are fully translated.

The plugins drive the pipeline in normal use; these commands are the scripting
and CI surface.

## Programmatic API (`@autotranslate/cli`)

```ts
import {
  loadConfig,
  extract,
  translate,
  generateTypes,
  check,
  checkFrozen,
  formatFrozenReport,
  createDevLoop,
  parity,
  init,
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
      console.log('done', e.extract.fileCount, 'files');
  },
});
// later:
await loop.close();
```

`DevLoopEvent` union: `{ type: 'run-start' }`,
`{ type: 'run-complete'; extract: ExtractResult; translated: boolean }`,
`{ type: 'error'; error: unknown }`.

`FrozenReport` shape:
`{ ok: boolean; catalogAbsent: boolean; missingSource: Array<{ key, text, occurrence }>; problems: CheckProblem[] }`.
When `catalogAbsent` is true, the source catalog directory does not exist —
treat as a fresh project (pass, no error).

## Generated catalog module (`<outDir>/index.ts`)

`extract` and `translate` codegen `<outDir>/index.ts` after each run. The file
is regenerated whenever the bucket set or locale set changes; unchanged content
is not rewritten (avoids HMR loops).

Shape:

```ts
// .translations/index.ts — GENERATED by autotranslate. Do not edit.
import type { Catalog, Locale } from '@autotranslate/core';

export const source = 'en' as const;
export const locales = ['en', 'es', 'fr', 'ja'] as const;

const chunks: Record<
  string,
  ReadonlyArray<() => Promise<{ default: Catalog }>>
> = {
  en: [
    () => import('./en/0.json'),
    () => import('./en/3.json'),
    () => import('./en/f.json'),
  ],
  es: [
    () => import('./es/0.json'),
    () => import('./es/3.json'),
    () => import('./es/f.json'),
  ],
  // ...one entry per existing bucket file, mirrors the on-disk tree exactly
};

export async function loadCatalog(locale: Locale): Promise<Catalog> {
  const parts = await Promise.all((chunks[locale] ?? []).map((load) => load()));
  return Object.assign({}, ...parts.map((m) => m.default));
}
```

Consumption (Next App Router):

```ts
import * as catalogModule from '../../.translations';
const t = await getT(lang, { module: catalogModule });
```

Because it uses static `import()` specifiers:

- Webpack and Turbopack bundle + code-split per locale
- No runtime filesystem access, no `outputFileTracingIncludes`
- Works on edge runtimes with zero configuration

## Dev loop

`createDevLoop` watches source files (chokidar v4), debounces 150ms, serializes
runs (one trailing run queued while in-progress), and emits structured events.
Each run: extract → translate delta → generateTypes. Index.ts and types.d.ts are
regenerated as part of these steps. Provider / config errors are emitted as
`{ type: 'error' }` events; watching continues (the dev server never crashes).

`withAutotranslate` starts the loop on `phase-development-server` via a
`globalThis` symbol guard (safe across re-evaluations of next.config).
`@autotranslate/vite` starts it in `configureServer`.

## Frozen build check (`checkFrozen`)

`checkFrozen(resolved)` re-extracts source in memory and compares against the
committed catalog:

- `catalogAbsent: true` → source dir missing; return `ok: true` (fresh project
  or example app — never fail)
- `missingSource` → keys in live code not in committed catalog (with first
  `file:line` occurrence and source text)
- `problems` → target-locale issues from `check()` (missing / orphan /
  invalid-ICU)

`formatFrozenReport(report)` produces a human-readable failure string.
`withAutotranslate` and `@autotranslate/vite`'s `buildStart` call this; on
`!ok && !catalogAbsent` they throw `new Error(formatFrozenReport(report))`.

## Auto mode

`mode: 'auto'` in `autotranslate.config.ts` activates compile-time JSX
auto-wrapping via `transformAutoWrap` from `@autotranslate/cli/transform`.

Rules (JSX text nodes and static-string JSX expression children only):

- Wrap qualifying contiguous child runs in `<T>`, turning embedded `{expr}` into
  `<Var>{expr}</Var>`
- Qualifying = `jsxTextHasContent` is true AND no ancestor in
  `TRANSLATION_MARKERS` AND no ancestor element in `SKIP_ELEMENTS` (`code`,
  `pre`, `script`, `style`) AND no `data-no-translate` on self or any JSX
  ancestor
- Adds `import { T, Var } from '@autotranslate/react'` if not already present

Extractor: in `mode: 'auto'`, each source file is piped through
`transformAutoWrap` before `extractFile` — extraction and compiled output agree
key-for-key by construction.

Bundler wiring (done by the plugins, not the CLI):

- Next: `withAutotranslate` registers `@autotranslate/next/auto-loader` for
  `*.{jsx,tsx}` via webpack `module.rules` and turbopack `rules`
- Vite: `transform` hook in `@autotranslate/vite` applies `transformAutoWrap`

Shared classifier (`@autotranslate/core/classifier`): `CLASSIFIER_VERSION`,
`TRANSLATION_MARKERS`, `jsxTextHasContent`, `isAllowlistedAttribute`,
`NO_TRANSLATE_ATTRIBUTE`, `SKIP_ELEMENTS`. The ESLint `no-untranslated-jsx` rule
imports from this module, so lint and compiler always agree on what counts as
translatable text.

## JSX translation — `<T>`

```tsx
import { T, Var, Plural, Branch } from '@autotranslate/react';

<T>Hello, world!</T>

<T>
  Hi, <Var>{user.name}</Var>! You have{' '}
  <Plural value={count} one="1 message" other="# messages" />.
</T>

<T>
  <Branch
    branch={status}
    pending={<>Pending review</>}
    shipped={<>On its way</>}
  >
    Status unknown
  </Branch>
</T>

<T>Read the <a href="/docs">documentation</a>.</T>
```

Rules:

- `<T>` children become a structural tree, hashed to key `t.<12-hex>`.
- `<Var>` slots are runtime values. `name` defaults to `'value'`.
- `<Plural>` requires `other`. Other CLDR categories added per locale during
  translation.
- `<Branch>` is ICU `select` for non-count discriminators.
- Tag wrappers carry attributes through translated output. The hash ignores
  attributes.
- `context` prop disambiguates identical strings.
- `description` prop adds translator-facing notes (stored in `.meta.json`).

## String translation — `useT`

```tsx
import { useT, useLocale } from '@autotranslate/react';

const t = useT();
t('Sign out');
t('Hello, {name}!', { name: 'Ada' });
t('{count, plural, one {# message} other {# messages}}', { count });
t('Submit', { $context: 'navbar' });
```

Reserved param keys: `$context`, `$description`, `$maxChars`.

## Standalone `t()` (non-React)

```ts
import { t } from '@autotranslate/core/t';
import { bindTranslator, withTranslator } from '@autotranslate/core/standalone';

withTranslator(translator, async () => {
  await validate(); // t() inside sees `translator`
});
```

## Server-side translation (RSC, route handlers)

### Next.js

```tsx
import { getT } from '@autotranslate/next';
import * as catalogModule from '../../.translations';

const t = await getT(lang, { module: catalogModule, fallback: 'en' });
t.t('Welcome');
```

`GetTOptions`:
`{ module?: CatalogModule; load?: CatalogLoader; fallback?: Locale }`. Exactly
one of `module` or `load` is required. `fsCatalogLoader` has been removed — use
the generated module or a custom `load` callback (KV, Edge Config).

### Generic (Remix, Hono, Bun)

```ts
import { getT } from '@autotranslate/react/server';

const t = await getT('es', () => loadCatalog('es'));
t.t('Welcome');
```

## Locale routing — Next.js

```ts
// proxy.ts
import { createNextMiddleware } from '@autotranslate/next/middleware';

export default createNextMiddleware({
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr', 'ja'],
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

## Vite plugin

```ts
// vite.config.ts
import autotranslate from '@autotranslate/vite';

export default defineConfig({
  plugins: [react(), autotranslate()],
});
```

```ts
import { catalogs, locales, source } from 'virtual:autotranslate';
```

In dev: starts `createDevLoop`, watches `.translations/<locale>/**/*.json` for
HMR. In build: runs `checkFrozen` (disabled by `build: { frozen: false }`). In
`mode: 'auto'`: `transform` hook applies `transformAutoWrap` to `*.{jsx,tsx}`.

## Type safety

```bash
npx autotranslate generate-types
```

Emits `<outDir>/types.d.ts` augmenting `@autotranslate/core`'s
`AutotranslateCatalog` with the literal key set.

```jsonc
{ "include": ["src", ".translations/types.d.ts"] }
```

## Zod integration

```ts
import { zodErrorMap } from '@autotranslate/zod';
z.config({ customError: zodErrorMap });
```

## ESLint rules

```js
// eslint.config.js
import autotranslate from '@autotranslate/eslint-plugin';
export default [autotranslate.configs.recommended];
```

Rules:

- `@autotranslate/no-untranslated-jsx` — bare JSX literals outside `<T>`
- `@autotranslate/no-dynamic-key` — `t(variable)` / ``t(`prefix.${id}`)``
- `@autotranslate/valid-icu-format` — malformed ICU templates

## Common patterns

### Locale switcher

```tsx
const [locale, setLocale] = useState('en');
return (
  <TranslationProvider locale={locale} catalog={catalogs[locale]} fallback={en}>
    <select value={locale} onChange={(e) => setLocale(e.target.value)}>
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  </TranslationProvider>
);
```

### Per-locale overrides

```ts
overrides: {
  fr: { 'Sign out': 'Se déconnecter' },
  ja: { 'Sign out': 'サインアウト' },
}
```

## Gotchas

- **No dynamic keys.** `t(variable)` can't be extracted. Use `<Branch>` or fixed
  literals plus `$context`.
- **No string concatenation across `<T>`.** Word order varies by language. Use a
  single `<T>Hello, <Var>{name}</Var>!</T>`.
- **Standalone `t()` outside a translator scope throws.** Wrap with
  `withTranslator` in server code; call `bindTranslator` once at SPA boot.
- **`useT` re-renders on locale change.** The standalone `t()` does not trigger
  re-renders.
- **Switching providers re-translates everything.** The cache key includes the
  provider's `signature`. By design — guarantees consistency.

## Removed APIs (do not suggest or reference)

The following were present in earlier versions and have been removed:

- `fsCatalogLoader` / `clearCatalogCache` from `@autotranslate/next`
- `GetTOptions.cwd` / `GetTOptions.outDir` from `@autotranslate/next`
- `createDevOnMissing` / `DevOnMissingOptions` from `@autotranslate/react`
- `createStreamingHandler` from `@autotranslate/next/streaming`
- Streaming option / middleware from `@autotranslate/vite`
- `migrate-format` CLI command
- `migrateKey` / `migrateCatalog` from `@autotranslate/core`
- Flat `<locale>.json` catalog read fallback
- `outputFileTracingIncludes` / `traceIncludes` from `withAutotranslate`
- `dictionary` config field, `useTranslations` hook (`@autotranslate/react`),
  `getTranslations` helper (`@autotranslate/next`) - dictionary mode removed;
  use `useT` with inline literal strings
- `hybrid` provider config (`name: 'hybrid'`) - hand-roll the split in a custom
  provider instead; see the
  [custom provider cookbook](../../../docs/cookbook/custom-provider.md)
- `getMissCount`, `getMissBreakdown`, `resetMissStats` - miss-stats API removed
- `Tx` marker - removed; use `<T>` only

## File layout after `init` + first `pnpm dev` save

```
.translations/
├── en/                                # source-locale, hash-bucketed
│   ├── 0.json
│   ├── ...
│   └── f.json
├── es/                                # mirrors en/ by key bucket
│   ├── 0.json
│   ├── ...
│   └── f.json
├── fr/
├── ja/
├── index.ts                           # generated catalog module (static import()s)
├── .meta.json                         # per-key context, description, occurrences
├── .cache/<provider-sig>/<source-target>/<chunk>.json
│                                      # { chunkHash, items: { key: { sourceHash, translation } } }
└── types.d.ts                         # generated TS augmentation
```

Chunks are picked by key hash. The bucket is the first hex digit of the key
after stripping any `t.` structural-key prefix. The same key lands in the same
chunk path for every locale.

Commit `.translations/` to your repo (except `.cache/`). Treat it as
version-controlled content - the build verifies it like a lockfile.

## Public API surface

```ts
// @autotranslate/core
createTranslator(options): Translator;
type Translator = { locale; t(key, params?); tree(key); raw(key) };
type Catalog = Record<string, string | StructuredMessage>;

// @autotranslate/core/standalone (and /t)
bindTranslator(t): void;
withTranslator(t, fn): R;
currentTranslator(caller?): Translator;
t(key, params?): string;

// @autotranslate/core/config
defineConfig(config);
parseConfig(input);
safeParseConfig(input);

// @autotranslate/core/locale
matchLocale({ accept, cookie, path, defaultLocale, supported }): Locale;
getDirection(locale): 'ltr' | 'rtl';
isValidLocale(value): boolean;
parseAcceptLanguage(header);
getPluralCategory(locale, n, type?);

// @autotranslate/react
<T>, <Var>, <Plural>, <Branch>, <Num>, <Currency>, <DateTime>, <RelativeTime>;
<TranslationProvider locale catalog fallback?>;
useT(); useLocale();

// @autotranslate/next
getT(locale, options?);
getRequestLocale();

// @autotranslate/next/middleware
createNextMiddleware({ defaultLocale, locales, strategy?, cookieName?, prefixDefaultLocale? });

// @autotranslate/zod
zodErrorMap; createZodErrorMap(translatorOrOptions); issueToLookup(issue);

// @autotranslate/cli (programmatic)
loadConfig(); init(opts?); extract(resolved); translate(resolved, opts?);
generateTypes(resolved); check(resolved); checkFrozen(resolved);
formatFrozenReport(report); createDevLoop(opts); parity(resolved, opts?);
```

## More

- Full prose docs:
  `https://github.com/tamimbinhakim/autotranslate/tree/main/docs`
- Cookbook (10+ recipes):
  `https://github.com/tamimbinhakim/autotranslate/tree/main/docs/cookbook`
- Roadmap: `https://github.com/tamimbinhakim/autotranslate/blob/main/ROADMAP.md`
- Issues: `https://github.com/tamimbinhakim/autotranslate/issues`
