# autotranslate docs

Code-first, AI-powered i18n for React. Write strings the way you write code; the
framework plugin handles everything else.

## Start here

- **[Quick start](quick-start.md)** - translate your first string in five
  minutes
- **[Concepts](concepts.md)** - keys, catalogs, the dev loop, and frozen builds
  on one page
- **[Philosophy](philosophy.md)** - why code is the source of truth, and the
  design choices that follow

## Frameworks

- **[Next.js](frameworks/nextjs.md)** - App Router, `withAutotranslate`, locale
  routing, RSC, edge
- **[Vite](frameworks/vite.md)** - virtual catalog module, dev loop, HMR
- **[Remix / React Router](frameworks/remix.md)** - loaders, actions

## Guides

The features, in depth.

- **[JSX translation](guides/jsx.md)** - `<T>`, `<Var>`, tag wrappers, context
- **[String translation](guides/strings.md)** - `useT`, plain-string lookups
- **[Standalone `t()`](guides/standalone-t.md)** - sync translator for non-React
  code
- **[Plurals & branches](guides/plurals.md)** - `<Plural>`, `<Branch>`, ICU
  plural rules
- **[Formatters](guides/formatters.md)** - `<Num>`, `<Currency>`, `<DateTime>`,
  `<RelativeTime>`
- **[Providers](guides/providers.md)** - AI, DeepL, Google, custom
- **[Type safety](guides/typesafety.md)** - narrow `useT` keys, generated unions
- **[Linting](guides/linting.md)** - catch untranslated copy at write time

## Cookbook

Task-oriented recipes for the patterns that actually come up.

- **[Locale switcher](cookbook/locale-switcher.md)**
- **[Translating form-validation errors](cookbook/form-validation.md)**
- **[Server Actions / route handlers](cookbook/server-actions.md)**
- **[Testing translated UI](cookbook/testing.md)**
- **[Overrides & brand glossaries](cookbook/overrides-and-glossary.md)**
- **[CI / CD pipelines](cookbook/ci-cd.md)**
- **[PR parity report](cookbook/pr-parity.md)**
- **[Lazy-loading large catalogs](cookbook/lazy-loading.md)**
- **[Rich text & HTML in translations](cookbook/rich-text-and-html.md)**
- **[Custom translation provider](cookbook/custom-provider.md)**
- **[Debugging missing keys](cookbook/debugging.md)**

## Integrations

- **[Zod](integrations/zod.md)** - translated validation errors

## Migrating

- **[From react-i18next](migrating/react-i18next.md)**
- **[From next-intl](migrating/next-intl.md)**
- **[From lingui](migrating/lingui.md)**
- **[From gt-next / gt-react](migrating/gt-next.md)**

## Reference

- **[Configuration](reference/configuration.md)** - `autotranslate.config.ts`
  schema
- **[CLI](reference/cli.md)** - every command, every flag
- **[API](reference/api.md)** - typed exports per package

## Examples

- **[`examples/next-app`](../examples/next-app)** - Next.js App Router demo
- **[`examples/vite-react`](../examples/vite-react)** - Vite + React SPA
