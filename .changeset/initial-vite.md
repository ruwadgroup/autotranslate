---
'@autotranslate/vite': minor
---

Initial implementation of `@autotranslate/vite`:

- Default-export plugin factory that resolves a `virtual:autotranslate` module
  exporting `catalogs`, `source`, and `locales` populated at build time from
  `.translations/*.json`.
- Auto-loads `autotranslate.config.{ts,mts,js,mjs}` from the Vite project root
  via `jiti`. Plugin options override every config-derived value; pass `config`
  to skip the disk lookup entirely (useful when the same config is already
  imported in `vite.config.ts`).
- Dev-mode HMR: watches `<outDir>` and triggers a full reload when any locale
  JSON changes, so re-running `pnpm i18n` propagates without a manual refresh.
- `@autotranslate/vite/client` subpath ships a `client.d.ts` that declares the
  `virtual:autotranslate` module — add it to `types` in your `tsconfig` once and
  the imports type-check cleanly.
- 6 tests covering virtual-module resolution, catalog inlining, missing- catalog
  tolerance, inline-config option, and the no-match short-circuit.
