# @autotranslate/vite

Vite plugin for autotranslate. Drives the dev loop on save, bundles translation
catalogs into a virtual module, and verifies the catalog is complete at build
time.

```bash
pnpm add @autotranslate/react
pnpm add -D @autotranslate/vite @autotranslate/cli
npx autotranslate init --framework vite
```

## Quick start

```ts
// vite.config.ts
import autotranslate from '@autotranslate/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), autotranslate()],
});
```

The plugin reads `autotranslate.config.ts` from the Vite project root for
`source`, `targets`, `outDir`, `mode`, and `build` settings.

## Virtual module

```ts
// src/main.tsx
import { TranslationProvider } from '@autotranslate/react';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { catalogs, locales } from 'virtual:autotranslate';

function Root() {
  const [locale, setLocale] = useState('en');
  return (
    <TranslationProvider
      locale={locale}
      catalog={catalogs[locale] ?? {}}
      fallback={catalogs['en'] ?? {}}
    >
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

Add the client types reference once in your app's tsconfig so
`'virtual:autotranslate'` imports type-check:

```jsonc
// tsconfig.app.json
{
  "compilerOptions": {
    "types": ["vite/client", "@autotranslate/vite/client"],
  },
}
```

The virtual module exports:

- `catalogs: Readonly<Record<Locale, Catalog>>` - every locale bundled at build
  time
- `source: Locale` - the source-locale tag
- `locales: ReadonlyArray<Locale>` - `[source, ...targets]`

HMR triggers whenever any file under `.translations/<locale>/**/*.json` changes.

## Dev loop

When the dev server starts, the plugin dynamically imports `@autotranslate/cli`
and starts `createDevLoop`. It watches your `config.content` globs with
chokidar, debounces 150ms, and on each save runs extract - translate delta -
generate-types, then triggers HMR. Provider errors are logged but never crash
the dev server.

## Build: frozen catalog check

At `buildStart` the plugin calls `checkFrozen`: it re-extracts source in memory
and compares against the committed catalog. If any source string is missing the
build fails with a precise list. The translation model is never called at build
time - CI needs no API key.

Disable with `build: { frozen: false }` in plugin options or in
`autotranslate.config.ts`.

## Auto mode

When `mode: 'auto'` is set in `autotranslate.config.ts`, the plugin's
`transform` hook wraps JSX text nodes in `<T>` at compile time:

```tsx
// author writes
<p>Hello {user.name}</p>

// compiler emits
<p><T>Hello <Var>{user.name}</Var></T></p>
```

Add `data-no-translate` to any element to opt out. `code`, `pre`, `script`, and
`style` are always skipped.

## Options

The plugin auto-discovers from `autotranslate.config.ts`, so the option object
is rarely needed.

| Option         | Type                  | Default                            |
| -------------- | --------------------- | ---------------------------------- |
| `cwd`          | `string`              | Vite project root                  |
| `outDir`       | `string`              | from config (`.translations`)      |
| `source`       | `string`              | from config (`'en'`)               |
| `locales`      | `ReadonlyArray<...>`  | `[source, ...targets]` from config |
| `config`       | `AutotranslateConfig` | inline config - skips disk lookup  |
| `build.frozen` | `boolean`             | from config (`true`)               |

---

Full docs:
[github.com/tamimbinhakim/autotranslate/docs/frameworks/vite.md](https://github.com/tamimbinhakim/autotranslate/blob/main/docs/frameworks/vite.md)
