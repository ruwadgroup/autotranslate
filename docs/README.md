# autotranslate docs

Code-first, AI-powered i18n for React. Write strings the way you write code, run
a command, get translated catalogs.

## Start here

- **[Overview](overview.md)** — what autotranslate does and where it fits
- **[Installation](installation.md)** — packages and version matrix
- **[Quick start](quick-start.md)** — translate your first string in five
  minutes
- **[Concepts](concepts.md)** — catalogs, keys, locales, ICU on one page
- **[FAQ](faq.md)** — quick answers to common questions

## Guides

The features, in depth.

- **[JSX translation](guides/jsx.md)** — `<T>`, `<Var>`, tag wrappers, context
- **[String translation](guides/strings.md)** — `useT`, `useTranslations`,
  dictionaries
- **[Standalone `t()`](guides/standalone-t.md)** — sync translator for non-React
  code
- **[Plurals & branches](guides/plurals.md)** — `<Plural>`, `<Branch>`, ICU
  plural rules
- **[Formatters](guides/formatters.md)** — `<Num>`, `<Currency>`, `<DateTime>`,
  `<RelativeTime>`
- **[Providers](guides/providers.md)** — AI, DeepL, Google, custom, hybrid
- **[Type safety](guides/typesafety.md)** — narrow `useT` keys, generated unions
- **[Linting](guides/linting.md)** — catch untranslated copy at write time

## Frameworks

- **[Next.js](frameworks/nextjs.md)** — App Router, proxy, RSC, edge
- **[Vite](frameworks/vite.md)** — virtual catalog module, HMR
- **[Remix / React Router](frameworks/remix.md)** — loaders, actions

## Integrations

- **[Zod](integrations/zod.md)** — translated validation errors

## Cookbook

Task-oriented recipes for the patterns that actually come up.

- **[Locale switcher](cookbook/locale-switcher.md)**
- **[Translating form-validation errors](cookbook/form-validation.md)**
- **[Server Actions / route handlers](cookbook/server-actions.md)**
- **[Testing translated UI](cookbook/testing.md)**
- **[Adding a new locale](cookbook/adding-a-locale.md)**
- **[Overrides & brand glossaries](cookbook/overrides-and-glossary.md)**
- **[CI / CD pipelines](cookbook/ci-cd.md)**
- **[Lazy-loading large catalogs](cookbook/lazy-loading.md)**
- **[Rich text & HTML in translations](cookbook/rich-text-and-html.md)**
- **[Debugging missing keys](cookbook/debugging.md)**

## Reference

- **[Configuration](reference/configuration.md)** — `autotranslate.config.ts`
  schema
- **[CLI](reference/cli.md)** — every command, every flag
- **[API](reference/api.md)** — typed exports per package

## Examples

- **[`examples/next-app`](../examples/next-app)** — Next.js App Router demo
- **[`examples/vite-react`](../examples/vite-react)** — Vite + React SPA
