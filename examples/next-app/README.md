# example: Next.js App Router

End-to-end demo of `@autotranslate/next` + `@autotranslate/react` on the Next.js
App Router. Locale routing via `proxy.ts`, server-component translation,
RSC-aware client markers.

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter @autotranslate/example-next-app dev
```

Open <http://localhost:3000> — paths under `/<locale>/...` resolve to the
matching catalog.

## Re-translate

The example ships with pre-generated `.translations/`. To re-run extraction and
translation against your own provider:

```bash
pnpm --filter @autotranslate/example-next-app i18n
```

Configure the provider in `examples/next-app/autotranslate.config.ts`.

## Layout

- `proxy.ts` — `createNextMiddleware({ defaultLocale, locales })`
- `app/[lang]/layout.tsx` — wraps the tree in `<TranslationProvider>` and loads
  the active catalog via `getT(locale)`
- `app/[lang]/page.tsx` — server-component translation with `getT().t(...)`
- `.translations/{en,es,fr,ja}.json` — generated catalogs

> [!NOTE] This example pins **Next.js 16+**. The `proxy` file convention
> replaces `middleware`; route `params` are async. Read the relevant guide in
> `node_modules/next/dist/docs/` before editing.
