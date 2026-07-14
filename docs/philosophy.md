# Philosophy

autotranslate is built on one belief: **the code is the only source of truth for
translatable copy**. The catalogs aren't a parallel system you hand-author or
curate; they're a derived, regenerable artifact - like TypeScript declarations,
like a build folder.

Most i18n libraries treat translations as content authored separately from code.
You write `t('cart.checkout')` in the source and someone fills in
`cart.checkout = "Check out"` in `en.json`. Two sources of truth, perpetual
drift, refactor-aversion baked in.

We do it the other way. The English string lives in your component:

```tsx
<button>{t('Check out')}</button>
```

The catalog is a build artifact you commit because diffs are useful in PRs, not
because it's where the canonical answer lives. Move the button, rename the
component, change the wording - the catalog follows. There is no key directory
to maintain, no namespace to invent, no handoff ceremony.

## Where the AI fits

Code-first authoring only solves half the problem. The other half is: how do
non-English locales get filled in?

Three options for that:

1. **A human translator hand-edits each target file.** This is what
   `react-i18next` / `next-intl` users do. It works, but it's the bottleneck
   most apps never escape.
2. **A SaaS handles the translation cloud-side.** This is `gt-next`'s model.
   Convenient, but it gives a vendor your copy and your routing layer.
3. **The AI is invoked at dev / build time, output is committed locally.** This
   is autotranslate's model.

Option 3 is the only one that keeps "code as source of truth" working
end-to-end. The AI sees your source strings, your context hints, your glossary;
it produces target translations; those land in the chunked catalog files; you
review them like any other PR diff. No vendor, no cloud, no parallel authoring
system.

## Why we don't have a `translations/` folder

A common request: "give us a hand-authored `translations/` directory where
humans put the final canonical strings, and `.translations/` is just AI
scratch."

We don't, and we won't, because it recreates the original problem. Two sources
of truth, drift, the same `cart.checkout` lookups everyone spends years
untangling.

When you need to influence what the AI produces, the lever is **upstream of
translation**, not downstream:

- **`instruction`** - global tone / voice / brand rules. Goes into the system
  prompt for every batch.
- **`glossary`** - terms the AI must never translate or transliterate. Prepended
  to the instruction.
- **`<Var>`** - opaque slots inside `<T>` blocks. The AI sees a placeholder, the
  runtime substitutes the literal value.
- **`context` / `description`** props on `<T>` (or `$context` on `useT`).
  Disambiguate identical strings; pass guidance to translators.

These compose. They're code. They version-control like code.

## When overrides are the right answer

The `overrides` config field exists for one case: **the AI got something
definitively wrong in one specific locale, and no upstream guidance fixes it
cheaply.** A specific French legal phrase that has to read exactly one way. A
trademark whose Japanese rendering must match the registered form
character-by-character.

Reach for `overrides` after you've tried:

- Tightening `instruction` with a one-line rule.
- Adding the term to `glossary`.
- Wrapping a `<Var>` around the specific span.
- Adjusting the source string to remove ambiguity.

If the AI still gets it wrong, lock the answer in `overrides`. But it's the
escape hatch, not the primary surface. A codebase whose `overrides` file is
hundreds of lines is one whose AI prompt isn't doing enough work.

## Evolution - how we got here

| Version  | What it was about                                                                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.1     | The runtime + extractor. `<T>`, `<Plural>`, `<Branch>`, `useT`. Vite SPA proven end-to-end.                                                                                                                     |
| v0.2     | Next.js + RSC. Locale routing in `proxy.ts`. `getT()` for server components.                                                                                                                                    |
| v0.3     | Vite plugin with virtual catalog module + HMR.                                                                                                                                                                  |
| v0.4     | Type generation. ESLint plugin (`no-untranslated-jsx`, `no-dynamic-key`, `valid-icu-format`).                                                                                                                   |
| v0.5     | DeepL + Google providers. Hybrid provider for cost-aware routing.                                                                                                                                               |
| v0.6     | Standalone `t()` for non-React code. `@autotranslate/zod` integration. Cookbook with 11 real recipes.                                                                                                           |
| v0.7     | Hash-bucketed catalog layout. Glossary, instruction, overrides. `createDevLoop` moved into `@autotranslate/cli` as the extraction and translation engine.                                                       |
| 1.0-beta | Plugin is the product. `withAutotranslate` (Next.js) and `@autotranslate/vite` own the full pipeline. Generated `<outDir>/index.ts` delivers catalogs. Frozen-build check at compile time. CI needs no API key. |

Each release is one cumulative piece, not a rewrite. The runtime contract
(`Translator`, `Catalog`, ICU MessageFormat) hasn't shifted since v0.1. The
on-disk format moved from flat-per-locale to hash-bucketed in v0.7 because real
apps need diffable, reviewable, parallelizable catalogs - but the migration was
silent and the public API never broke.

## What we won't do

- **Parallel hand-authored target catalogs.** Two sources of truth, no.
- **Cloud-hosted catalogs.** Self-hosted is the pitch. We won't contradict it.
- **Runtime translation.** The runtime never calls a model. Translation happens
  at dev / build time only. Production paths are pure lookup + ICU formatting.
- **A separate vendor account or sign-in.** You bring your own AI provider key.
  We never see your traffic.

## What we will do

- Make the AI's output better when it matters: glossary, prompt-cache prefixes,
  better instruction hooks.
- Make catalogs more reviewable: chunking, per-feature splits, PR-comment
  integrations.
- Make framework integration boring: more adapters, less ceremony.
- Make the dev loop tighter: incremental extraction, LSP-level diagnostics,
  type-narrowed keys everywhere.

If something here is wrong for you,
[open an issue](https://github.com/ruwadgroup/autotranslate/issues). The roadmap
bends; the philosophy stays.
