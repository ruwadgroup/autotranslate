# Vite

`@autotranslate/vite` bundles your translation catalogs into a virtual module,
drives the dev loop on save, and verifies the catalog at build time.

## Setup

Run `init` once - it wires everything:

```bash
pnpm add @autotranslate/react
pnpm add -D @autotranslate/vite @autotranslate/cli
npx autotranslate init --framework vite
```

Then add the plugin to your Vite config:

```ts
// vite.config.ts
import autotranslate from '@autotranslate/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), autotranslate()],
});
```

The plugin reads `autotranslate.config.{ts,mts,js,mjs}` from the Vite project
root for `source`, `targets`, `outDir`, `mode`, and `build` settings.

## Virtual module

```ts
// src/catalogs.ts
import type { Catalog } from '@autotranslate/core';
import { catalogs, locales, source } from 'virtual:autotranslate';

export function useCatalog(locale: string): Catalog {
  return catalogs[locale] ?? {};
}

export { locales, source };
```

The virtual module exports:

- `catalogs: Readonly<Record<Locale, Catalog>>` - every locale's catalog,
  bundled at build time by merging each locale's chunk tree
  `<outDir>/<locale>/**/*.json`
- `source: Locale` - the source-locale tag
- `locales: ReadonlyArray<Locale>` - `[source, ...targets]`

HMR triggers whenever any file under `.translations/<locale>/**/*.json` changes.
In dev mode the plugin also starts the dev loop (see below), so HMR fires
automatically after each save.

## TypeScript

Add the client types reference once in your app's tsconfig:

```jsonc
// tsconfig.app.json
{
  "compilerOptions": {
    "types": ["vite/client", "@autotranslate/vite/client"],
  },
}
```

Declares the `'virtual:autotranslate'` module so imports type-check.

## Wire into the runtime

```tsx
// src/main.tsx
import { TranslationProvider } from '@autotranslate/react';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { locales, useCatalog } from './catalogs';

function Root() {
  const [locale, setLocale] = useState<string>('en');
  const catalog = useCatalog(locale);
  const fallback = useCatalog('en');
  return (
    <TranslationProvider locale={locale} catalog={catalog} fallback={fallback}>
      <App locale={locale} locales={locales} onChangeLocale={setLocale} />
    </TranslationProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
```

## Dev loop

When the dev server starts (`configureServer`), the plugin dynamically imports
`@autotranslate/cli` and starts `createDevLoop`:

- Watches your `config.content` globs with chokidar (ignores outDir and
  node_modules)
- Debounces 150ms, serializes runs (one trailing run queued while in-progress)
- Each run: extract → translate delta → generate-types → catalog module regen
- Emits file changes to `.translations/` that the existing watcher picks up,
  triggering HMR

Provider errors are logged but never crash the dev server. If
`@autotranslate/cli` is not resolvable, the plugin warns once and falls back to
manual-run mode (HMR still fires when you run `autotranslate translate`
manually).

## Build: frozen catalog check

At build time (`buildStart`), the plugin runs `checkFrozen` from
`@autotranslate/cli`: it re-extracts your source in memory and compares it
against the committed catalog. If any source string is not committed, the build
fails with a precise list:

```
Catalog is out of date.

2 source strings not committed to .translations:
  - 'Check out' (components/Cart.tsx:41)
  - 'Empty cart' (components/Cart.tsx:58)

Run your dev server or `autotranslate translate`, then commit .translations/
```

The translation model is never called at build time. CI needs no API key.

Disable with `build: { frozen: false }` in your plugin options or in
`autotranslate.config.ts`.

## Auto mode (mode: 'auto')

When `mode: 'auto'` is set in `autotranslate.config.ts`, the plugin's
`transform` hook applies `transformAutoWrap` to every `*.{jsx,tsx}` file
(excluding node_modules), wrapping JSX text nodes in `<T>` at compile time.

```tsx
// author writes
<p>Hello {user.name}, welcome</p>

// compiler emits
<p><T>Hello <Var>{user.name}</Var>, welcome</T></p>
```

Add `data-no-translate` to any element to opt out:

```tsx
<p data-no-translate>SKU-{id}</p>
```

Elements `code`, `pre`, `script`, and `style` are always skipped. See
[Configuration](../reference/configuration.md#mode).

## Options

The plugin auto-discovers from `autotranslate.config.ts`, so the option object
is rarely needed.

```ts
autotranslate({
  cwd: __dirname,
  outDir: '.locales',
  locales: ['en', 'fr', 'es'],
  source: 'en',
  build: {
    frozen: false, // disable frozen check for this project
  },
});
```

| Option         | Type                  | Default                            |
| -------------- | --------------------- | ---------------------------------- |
| `cwd`          | `string`              | Vite project root                  |
| `outDir`       | `string`              | from config (`.translations`)      |
| `source`       | `string`              | from config (`'en'`)               |
| `locales`      | `ReadonlyArray<...>`  | `[source, ...targets]` from config |
| `config`       | `AutotranslateConfig` | inline config - skips disk lookup  |
| `build.frozen` | `boolean`             | from config (`true`)               |

When `config` is supplied the plugin skips the `autotranslate.config.*` search
entirely.

## Build-time inlining

At build time the plugin reads each locale's chunk tree
`<outDir>/<locale>/**/*.json`, merges the chunks, and inlines the merged
catalogs as JSON literals in the virtual module. Same effect as a raw
`import.meta.glob` over the locale chunk files, but with proper TypeScript types
and catalog merging.

For very large catalogs, code-split per-locale by lazy-loading the virtual
module:

```ts
const { catalogs } = await import('virtual:autotranslate');
```

Vite produces one chunk per dynamic import, so each locale's JSON only ships
when first requested. See [Lazy-loading](../cookbook/lazy-loading.md).

## SSR / pre-rendering

The virtual module works on the server too. Use `getT` from
`@autotranslate/react/server`:

```tsx
import { getT } from '@autotranslate/react/server';
import { catalogs } from 'virtual:autotranslate';

export async function render({ locale }: { locale: string }) {
  const t = await getT(
    locale,
    () => catalogs[locale] ?? {},
    () => catalogs.en ?? {},
  );
  return `<h1>${t.t('Welcome')}</h1>`;
}
```

## Tips

- **Do not import raw catalog chunks directly.** The virtual module handles HMR
  invalidation and chunk merging; raw imports bypass it.
- **Pin `outDir`.** If your config writes to a non-default dir, pass `outDir` to
  the plugin so the watcher tracks the right path.
- **Inlay hints.** Install `@autotranslate/typescript-plugin` to see translated
  values inline in your editor for every `t('...')` call.
