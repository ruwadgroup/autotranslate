---
'@autotranslate/typescript-plugin': minor
---

New package: `@autotranslate/typescript-plugin`

TypeScript Language Service plugin. Editor-time warning when `t('literal')` is
called with a key not yet in the source-locale catalog.

```json
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [{ "name": "@autotranslate/typescript-plugin" }]
  }
}
```

Tracks `useT()`, `useTranslations()`, and the standalone `t()` from
`@autotranslate/core/t`. Follows aliasing (`const t = useT()`). Catalog reads
are cached for 2s. Configurable: `outDir` (default `.translations`), `source`
(default `en`), `severity` (default `warning`).

JSX `<T>` checking lives in `@autotranslate/eslint-plugin`; this package covers
the string-side hooks.

VS Code: select **TypeScript: Use Workspace Version** so the plugin is loaded.
JetBrains IDEs pick it up automatically.
