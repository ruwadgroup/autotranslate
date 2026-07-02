# Quick start

Five minutes from empty project to a translated React app. The framework plugin
does the work: save a file, translations appear.

## 1. Install

```bash
# Next.js
pnpm add @autotranslate/next
pnpm add -D @autotranslate/cli

# Vite
pnpm add @autotranslate/react
pnpm add -D @autotranslate/vite @autotranslate/cli
```

The adapter brings `@autotranslate/core` (and `@autotranslate/react` on Next)
with it. `@autotranslate/cli` is the engine the plugin drives — extract,
translate, typegen. Remix and React Native need no adapter — see the
[Remix guide](frameworks/remix.md) and
[lazy-loading recipe](cookbook/lazy-loading.md).

## 2. Init

```bash
npx autotranslate init
```

`init` detects your framework from `package.json` and wires everything,
idempotently:

```
+ Detected Next.js
+ autotranslate.config.ts written           (provider: anthropic - key read from ANTHROPIC_API_KEY)
+ next.config.ts wrapped in withAutotranslate  (AST edit)
+ src/proxy.ts created                      (path-prefix locale routing)
+ tsconfig.json: added .translations/types.d.ts to include
+ .gitignore: added .translations/.cache/
~ app/[lang]/layout.tsx                     (manual diff - layout too custom to edit safely)

Next: run `pnpm dev` and write some copy. Translations appear on save.
```

Apply the printed layout diff (the one edit `init` won't make for you), set your
provider key, and install the AI SDK:

```bash
export ANTHROPIC_API_KEY=sk-ant-…
pnpm add ai @ai-sdk/anthropic
```

Flags: `--framework next|vite`, `--targets es,fr,ja`,
`--provider anthropic|openai|google|deepl|stub`, `--force`. Re-running is safe —
every step reports `done`, `already configured`, or `skipped` with a manual
diff.

## 3. Write copy

Start your dev server (`pnpm dev`) and write strings the way you write code:

```tsx
import { Plural, T, useT, Var } from '@autotranslate/react';

export function Greeting({ user, count }: { user: User; count: number }) {
  const t = useT();
  return (
    <section>
      <T>
        Hi, <Var>{user.name}</Var>! You have{' '}
        <Plural value={count} one="1 message" other="# messages" />.
      </T>
      <button type="button">{t('Sign out')}</button>
    </section>
  );
}
```

Two patterns:

- `<T>` for translatable JSX blocks. Markers (`<Var>`, `<Plural>`, `<Branch>`)
  describe the dynamic slots — see [JSX translation](guides/jsx.md).
- `useT()` for plain strings — button labels, `aria-*`, programmatic copy — see
  [String translation](guides/strings.md).

Prefer not to wrap at all? Set `mode: 'auto'` in the config and the compiler
wraps JSX text in `<T>` for you — see
[Configuration](reference/configuration.md#mode).

## 4. Save, and watch it translate

On save, the framework plugin's dev loop extracts new strings, translates the
delta, regenerates types, and hot-updates the running app — typically within a
couple of seconds. No commands to run. Under the hood each save runs extract →
translate → generate-types, writing:

```
.translations/
├── en/                               # source, hash-bucketed
│   ├── 0.json
│   ├── ...
│   └── f.json
├── es/                               # AI-translated, same buckets
├── fr/
├── ja/
├── index.ts                          # generated catalog module (bundler entry)
├── .meta.json                        # context, descriptions, occurrences
├── .cache/
│   └── <provider-sig>/<source-target>/<chunk>.json
└── types.d.ts                        # narrows useT keys — typos are TS errors
```

Provider errors never crash the dev server; the runtime falls back to source
text until the next successful run.

## 5. Load catalogs at runtime

The generated `<outDir>/index.ts` module is how catalogs reach your app:

- **Next.js / RSC** — `import * as catalogModule from '../../.translations'` and
  pass it to [`getT(lang, { module: catalogModule })`](frameworks/nextjs.md) or
  straight to `loadCatalog(lang)` in a layout.
- **Vite** — the plugin serves the [`virtual:autotranslate`](frameworks/vite.md)
  module with `catalogs`, `source`, and `locales`, HMR included.
- **Anything else** — call the module's `loadCatalog(locale)` yourself and pass
  the result to `TranslationProvider`.

Because the module uses static `import()` specifiers, bundlers code-split per
locale and no runtime filesystem access happens — it works on edge runtimes
as-is.

## 6. Commit `.translations/`

Treat the catalog like a lockfile: commit it with the source change that
produced it. `init` already gitignored `.translations/.cache/`; everything else
in `.translations/` belongs in the repo. Reviewers see translation diffs next to
code diffs — add the [PR parity report](cookbook/pr-parity.md) for a readable
table.

## 7. Build verifies — never translates

Production builds run a frozen-catalog check: the plugin re-extracts in memory,
compares against the committed catalog, and fails with a precise list when
anything is missing:

```
Catalog is out of date.

2 source strings not committed to .translations:
  - 'Check out' (components/Cart.tsx:41)
  - 'Empty cart' (components/Cart.tsx:58)

Run your dev server or `autotranslate translate`, then commit .translations/
```

The model is never called at build time, so CI needs no API key. See
[CI/CD](cookbook/ci-cd.md) and the `build` options in
[Configuration](reference/configuration.md#build).

## What's next

- **[Concepts](concepts.md)** — how keys, catalogs, locales, and ICU fit
  together
- **[JSX translation](guides/jsx.md)** — markers, plurals, branches, tag
  wrappers
- **[Type safety](guides/typesafety.md)** — narrow `useT` keys
- **[Next.js](frameworks/nextjs.md)** or **[Vite](frameworks/vite.md)** —
  framework setup in depth
- **[CLI reference](reference/cli.md)** — the commands behind the plugin, for
  scripting
- **[Cookbook](README.md#cookbook)** — recipes for real patterns
