---
'@autotranslate/react': minor
'@autotranslate/vite': minor
---

Streaming dev-mode translation

In dev, missing keys can now translate on first miss. The runtime hook plus a
Vite middleware close the "edit a string → see it translated" loop without
manually running `pnpm i18n`.

```ts
// vite.config.ts
import autotranslate from '@autotranslate/vite';
export default { plugins: [autotranslate({ streaming: true })] };
```

```tsx
// app entry — dev only
import { TranslationProvider, createDevOnMissing } from '@autotranslate/react';

<TranslationProvider
  locale={locale}
  catalog={catalog}
  onMissing={import.meta.env.DEV ? createDevOnMissing() : undefined}
>
```

When `useT('New string')` hits a key that isn't in the catalog yet, the runtime
POSTs to the dev endpoint, the server runs translate for that key, the chunk is
updated, and Vite's existing HMR triggers a reload.

Production: omit `onMissing`. The runtime falls back to source on miss (same
behaviour as today).

Next.js streaming dev mode is on the v0.9 roadmap; today the Next adapter relies
on running `pnpm i18n` between edits.
