# @autotranslate/vite

Vite plugin for autotranslate. Bundles your translation catalogs into a virtual
module and triggers HMR when `.translations/` changes.

```bash
pnpm add -D @autotranslate/vite
```

## Quick features

- **Virtual module.**
  `import { catalogs, source, locales } from 'virtual:autotranslate'` — fully
  type-safe, fully tree-shakeable.
- **Auto-discovery.** Reads `autotranslate.config.{ts,mts,js,mjs}` from the Vite
  project root for `source`, `targets`, and `outDir`.
- **Dev HMR.** Re-running `pnpm i18n` (or any tool that touches
  `.translations/*.json`) invalidates the virtual module without a manual
  refresh.
- **No glob hacks.** Same effect as
  `import.meta.glob('../.translations/*.json', { eager: true })` but without the
  path-stripping dance and with proper TypeScript types.

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

```ts
// src/catalogs.ts
import { catalogs, locales, source } from 'virtual:autotranslate';

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

## Options

| Option    | Type                  | Default                               |
| --------- | --------------------- | ------------------------------------- |
| `cwd`     | `string`              | Vite project root                     |
| `outDir`  | `string`              | from config (`.translations`)         |
| `source`  | `string`              | from config (`'en'`)                  |
| `locales` | `ReadonlyArray<...>`  | `[source, ...targets]` from config    |
| `config`  | `AutotranslateConfig` | inline config (skips the disk lookup) |

## API

- `default export` — the plugin factory
- `AutotranslatePluginOptions` type
- `VIRTUAL_MODULE_ID = 'virtual:autotranslate'`

The virtual module exports:

- `catalogs: Readonly<Record<Locale, Catalog>>`
- `source: Locale`
- `locales: ReadonlyArray<Locale>`
