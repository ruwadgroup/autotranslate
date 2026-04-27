# Vite

`@autotranslate/vite` bundles your translation catalogs into a virtual module
and triggers HMR when `.translations/` changes.

## Install

```bash
pnpm add -D @autotranslate/vite
```

## Setup

```ts
// vite.config.ts
import autotranslate from '@autotranslate/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), autotranslate()],
});
```

That's it. The plugin reads `autotranslate.config.{ts,mts,js,mjs}` from the Vite
project root for `source`, `targets`, and `outDir`, then exposes the catalogs as
a virtual module.

## Use the virtual module

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

- `catalogs: Readonly<Record<Locale, Catalog>>` — every locale's catalog,
  bundled at build time.
- `source: Locale` — the source-locale tag.
- `locales: ReadonlyArray<Locale>` — `[source, ...targets]`.

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

This declares the `'virtual:autotranslate'` module so imports type-check.

## Wire it into the runtime

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

## Dev HMR

Editing `.translations/<locale>.json` — typically by re-running `pnpm i18n` —
invalidates the virtual module and triggers a full reload. Your running app
picks up new translations without a manual refresh.

## Options

The plugin auto-discovers from `autotranslate.config.ts`, so the option object
is rarely needed. Override individual fields when you need to:

```ts
autotranslate({
  cwd: __dirname,
  outDir: '.locales',
  locales: ['en', 'fr', 'es'],
  source: 'en',
});
```

| Option    | Type                  | Default                             |
| --------- | --------------------- | ----------------------------------- |
| `cwd`     | `string`              | Vite project root.                  |
| `outDir`  | `string`              | from config (`.translations`).      |
| `source`  | `string`              | from config (`'en'`).               |
| `locales` | `ReadonlyArray<...>`  | `[source, ...targets]` from config. |
| `config`  | `AutotranslateConfig` | inline config — skips disk lookup.  |

When `config` is supplied the plugin skips the `autotranslate.config.*` search
entirely. Useful if you import the config in `vite.config.ts` for other reasons
(e.g. exposing locale lists to a build-time generator).

## Build-time inlining

At build time the plugin reads each `<outDir>/<locale>.json` and inlines them as
JSON literals in the virtual module. Same effect as
`import.meta.glob('../.translations/*.json', { eager: true })` but without the
path-stripping dance and with proper TypeScript types.

For very large catalogs, code-split per-locale by lazy-loading the virtual
module:

```ts
const { catalogs } = await import('virtual:autotranslate');
```

Vite produces one chunk per dynamic import, so each locale's JSON only ships
when first requested.

## Server entry

For SSR or pre-rendering with Vite (e.g. via Vike, Astro), the virtual module
works on the server too. Use
[`@autotranslate/react/server`](../api-reference.md#autotranslatereact-server)
for context-free translation:

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

- **Don't import `.translations/*.json` directly.** The virtual module handles
  HMR invalidation; raw imports bypass it.

- **Pin `outDir`.** If your CLI writes to a non-default dir, pass `outDir` to
  the plugin so the watcher tracks the right path.

- **Combine with the typegen.** Run `autotranslate generate-types` after
  `translate` so `useT()` autocompletes the bundled catalog keys.
