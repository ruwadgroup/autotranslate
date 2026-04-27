# example: Vite + React

End-to-end demo of `@autotranslate/vite` + `@autotranslate/react` in a
client-rendered React SPA. Catalogs are bundled via the virtual module; HMR
picks up `.translations/` changes without a manual reload.

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter @autotranslate/example-vite-react dev
```

## Re-translate

```bash
pnpm --filter @autotranslate/example-vite-react i18n
```

Configure the provider in `examples/vite-react/autotranslate.config.ts`.

## Layout

- `vite.config.ts` — registers the `autotranslate()` plugin
- `src/catalogs.ts` — imports `catalogs`, `source`, `locales` from
  `virtual:autotranslate`
- `src/App.tsx` — wraps the tree in `<TranslationProvider>` and switches locale
  on a dropdown
- `.translations/{en,es,fr}.json` — generated catalogs
