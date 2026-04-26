---
'@autotranslate/react': patch
---

Recognize translation markers (`<Var>`, `<Plural>`, `<Branch>`, `<Num>`,
`<Currency>`, `<DateTime>`, `<RelativeTime>`) when their JSX `type` field is a
`React.lazy`-shaped wrapper. Next.js / RSC server components rendering a client
component substitute the type with a `{$$typeof, _payload, _init}` thunk, so the
previous identity check (`child.type === Var`) silently failed and every marker
fell through to the generic `tag` path — translations were correctly written to
the catalog but never matched at runtime, so SSR rendered the source copy.

The serializer now resolves the lazy payload synchronously when present and
matches by `displayName` as a fallback. Identity-equal markers still take the
fast path; copy-equality still works in pure-client / Vite setups.
