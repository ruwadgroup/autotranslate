---
'@autotranslate/next': minor
---

Streaming dev-mode translation for Next.js

`@autotranslate/next/streaming` exports a `POST` handler that, in dev,
translates a new key on demand and writes it to the chunked catalog.

```ts
// app/api/__autotranslate/translate/route.ts
export { POST } from '@autotranslate/next/streaming';
```

Wire the runtime via `createDevOnMissing` from `@autotranslate/react` (point its
`endpoint` option at the same path). In production the handler returns 404 —
`NODE_ENV` gates it.

Closes the "edit a string → see it translated" loop in Next dev without manually
running `pnpm i18n` between edits. Caches are cleared automatically; the next
request picks up the new translation.
