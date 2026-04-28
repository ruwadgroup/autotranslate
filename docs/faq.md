# FAQ

## Does autotranslate replace my translators?

No. AI is the first pass; humans review. Edit `.translations/{locale}.json` by
hand to override anything the model got wrong, or use the `overrides` field in
`autotranslate.config.ts` to keep overrides separate from the AI-generated
catalog. See [Overrides & glossaries](cookbook/overrides-and-glossary.md).

## How do I add a new locale?

Add it to `targets` in `autotranslate.config.ts` and re-run
`autotranslate translate`. See
[Adding a new locale](cookbook/adding-a-locale.md).

## Will it re-translate everything every run?

No. The CLI hashes each source string and caches the (source, target, provider)
triple. Only changed strings hit the model. Switching providers or models
invalidates the cache automatically because the provider's `signature` is part
of the cache key.

## Does the runtime ship the AI provider?

No. The runtime (`@autotranslate/react`, `@autotranslate/core`) only contains
catalog lookup + ICU formatting. Translation providers live in
`@autotranslate/providers` and only run during `autotranslate translate`.

## Edge runtime support?

Yes. The runtime path uses no `node:fs`, no `process`, no `Buffer`. It works on
Vercel Edge, Cloudflare Workers, Bun, Deno. Catalog loading is your
responsibility on the edge — see
[Lazy-loading large catalogs](cookbook/lazy-loading.md) for KV / Edge Config
patterns.

## Can I use it without React?

The translator core (`@autotranslate/core`) is framework-agnostic. The
[standalone `t()`](guides/standalone-t.md) entry works in any sync code —
validators, route handlers, queue workers, tests.

## What about plurals in languages with five or more forms?

Russian, Polish, Welsh, Arabic — all handled. ICU plurals route on CLDR
categories (`zero`, `one`, `two`, `few`, `many`, `other`); the runtime picks the
right form via `Intl.PluralRules` for the active locale. Authors only need to
provide `other`; other forms are optional and added per locale where relevant.

## Does the AI know my brand voice?

It doesn't out of the box. Set `instruction` in your config:

```ts
provider: {
  name: 'ai',
  model: 'anthropic:claude-haiku-4-5',
  // …
},
instruction: 'Translate UI copy for a developer-tools product. Match a friendly, modern voice.',
```

For brand terms, use `overrides` to lock specific strings, or build a glossary
on top of `defineProvider`. See
[Overrides & glossaries](cookbook/overrides-and-glossary.md).

## How do I migrate from `react-i18next` / `next-intl` / `lingui`?

Migration guides per library are on the [roadmap](../ROADMAP.md). The general
shape:

1. Replace `t('key.name')` with the literal string.
2. Replace `<Trans>` with `<T>` and `<Var>` markers.
3. Run `autotranslate translate` to seed the catalogs.
4. Move existing translated strings into `overrides` (or paste them into the
   generated JSON).

## Why "the same string in two places gets the same translation"?

Because the key _is_ the string. If you have `t('Sign out')` in the navbar and
`t('Sign out')` in a dropdown, both look up the same catalog entry. To
disambiguate, use `$context`:

```ts
t('Sign out', { $context: 'navbar' });
t('Sign out', { $context: 'dropdown' });
```

## What's the catalog format? Will it change?

Pre-1.0, yes — see [the warning in the README](../README.md#status). After 1.0
the on-disk format is part of the public API contract.

## How do I lazy-load a catalog?

Per-locale dynamic imports work everywhere. Vite users get HMR-aware lazy
loading via the virtual module. Next users get fs-backed memoised loading via
`fsCatalogLoader`. See [Lazy-loading](cookbook/lazy-loading.md).

## Does it work with React Server Components?

Yes. Use `getT(locale)` from `@autotranslate/next` (or
`@autotranslate/react/server`) in server components and route handlers; use
`useT()` in client components. The `react-server` export condition is wired
automatically.

## Where do I report bugs?

[GitHub issues](https://github.com/tamimbinhakim/autotranslate/issues).
