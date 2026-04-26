---
'@autotranslate/react': patch
---

Add `"use client"` directive to the main bundle so Next.js App Router / RSC
bundlers treat the package as a client module. Every export from
`@autotranslate/react` (the `<T>` / `<Var>` / `<Plural>` components, `useT`,
`useLocale`, `TranslationProvider`) touches React hooks or context and was
already client-only in practice — this just makes the contract explicit so
server components can import the package without hitting
`"You're importing a component that needs ... use client"` build errors.

The directive is injected via a tsup `onSuccess` hook because esbuild strips
top-of-file directives during bundling. The `/server` subpath is unchanged —
it's still picked by the `react-server` export condition for RSC consumers.
