# @autotranslate/cli

The `autotranslate` CLI: scans your codebase, extracts translatable strings,
runs them through a translation provider, and writes locale catalogs.

```bash
pnpm add -D @autotranslate/cli
npx autotranslate init
npx autotranslate translate
```

Commands (planned):

- `autotranslate init` — scaffold `autotranslate.config.ts`
- `autotranslate extract` — AST scan, write `en.json`
- `autotranslate translate` — translate missing keys
- `autotranslate check` — verify all locales are in sync (CI-friendly)
- `autotranslate watch` — re-extract & translate on file change
- `autotranslate generate-types` — emit typed locale union and message keys
