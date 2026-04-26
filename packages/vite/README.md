# @autotranslate/vite

Vite plugin for autotranslate. Bundles your translation catalogs into a virtual
module and triggers HMR when `.translations/` changes.

```bash
pnpm add -D @autotranslate/vite
```

## Usage

```ts
// vite.config.ts
import autotranslate from '@autotranslate/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), autotranslate()],
});
```

```ts
// src/catalogs.ts
import { catalogs, source, locales } from 'virtual:autotranslate';

// catalogs.es, catalogs.fr, … all bundled at build time.
// `source` is your source locale; `locales` is the full list.
```

Add the client types reference once in your app's tsconfig:

```jsonc
// tsconfig.app.json
{
  "compilerOptions": {
    "types": ["vite/client", "@autotranslate/vite/client"],
  },
}
```

## How it works

The plugin auto-loads `autotranslate.config.{ts,mts,js,mjs}` from the Vite
project root to discover `source`, `targets`, and `outDir`. Override any of
those via plugin options.

At build time it reads each `<outDir>/<locale>.json` (created by
`autotranslate translate`) and inlines them as JSON literals in the virtual
module — same effect as
`import.meta.glob('../.translations/*.json', { eager: true })` but without the
path-stripping dance and with proper TypeScript types.

In dev, the plugin watches `<outDir>` and triggers a full reload when any locale
JSON changes — so re-running `pnpm i18n` updates the running app without a
manual refresh.

## Options

| Option    | Type                  | Default                               |
| --------- | --------------------- | ------------------------------------- |
| `cwd`     | `string`              | Vite project root                     |
| `outDir`  | `string`              | from config (`.translations`)         |
| `source`  | `string`              | from config (`'en'`)                  |
| `locales` | `ReadonlyArray<...>`  | `[source, ...targets]` from config    |
| `config`  | `AutotranslateConfig` | inline config (skips the disk lookup) |

## Public API

- `default export` — the plugin factory
- `AutotranslatePluginOptions` type
- `VIRTUAL_MODULE_ID = 'virtual:autotranslate'`

The virtual module exports:

- `catalogs: Readonly<Record<Locale, Catalog>>`
- `source: Locale`
- `locales: ReadonlyArray<Locale>`
