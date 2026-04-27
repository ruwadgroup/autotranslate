# Getting Started

This walkthrough takes you from an empty project to a fully-translated React app
in under five minutes.

## Prerequisites

- **Node.js** ≥ 20
- **pnpm**, **npm**, **yarn**, or **bun**
- A React app — Next.js, Vite, Remix, or anything React-based

## Install

```bash
pnpm add @autotranslate/react @autotranslate/core
pnpm add -D @autotranslate/cli
```

The CLI is a dev dependency — it only runs when you extract or translate. The
runtime packages stay in your production bundle.

For framework-specific extras, install the matching adapter:

```bash
# Next.js (App Router, proxy / middleware, RSC helpers)
pnpm add @autotranslate/next

# Vite (virtual catalog module + HMR)
pnpm add -D @autotranslate/vite
```

## Scaffold the config

```bash
npx autotranslate init
```

This writes `autotranslate.config.ts` to your project root:

```ts
import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr'],
  content: ['src/**/*.{ts,tsx,js,jsx}'],
  provider: { name: 'stub' },
});
```

Edit it for your project:

```ts
import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/**/*.{ts,tsx}'],
  provider: {
    name: 'ai',
    model: 'anthropic:claude-haiku-4-5',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
});
```

See the [Configuration reference](configuration.md) for every option.

## Wrap your app

```tsx
import { T, TranslationProvider } from '@autotranslate/react';

export function App() {
  return (
    <TranslationProvider locale="en">
      <T>Hello, world!</T>
    </TranslationProvider>
  );
}
```

`<TranslationProvider>` carries the active locale and catalog through React
context. `<T>` is the translatable JSX block — it walks its children, derives a
stable canonical key, and renders the translated tree at runtime.

Without a provider, the runtime degrades gracefully: every string renders
verbatim, no errors, no warnings.

## Use markers

`<Var>`, `<Plural>`, and `<Branch>` are structural markers inside `<T>`. They
tell the extractor where the dynamic slots are so the canonical key stays stable
across translations.

```tsx
import { Plural, T, Var } from '@autotranslate/react';

<T>
  Hi <Var>{user.name}</Var>! You have{' '}
  <Plural value={count} one="1 message" other="# messages" />.
</T>;
```

For non-JSX strings (button labels, `aria-*`, programmatic copy), use
[`useT`](guides/translating-strings.md):

```tsx
import { useT } from '@autotranslate/react';

function SignOutButton() {
  const t = useT();
  return <button type="button">{t('Sign out')}</button>;
}
```

## Translate

Run the CLI:

```bash
npx autotranslate translate
```

The CLI:

1. Scans `config.content` for `<T>` blocks and `useT('...')` calls.
2. Builds the canonical source-locale catalog at `.translations/<source>.json`.
3. Diffs against the per-target cache and only translates what changed.
4. Writes one JSON file per target locale.

Inspect the result:

```bash
.translations/
├── en.json           # source-locale catalog (config.source)
├── es.json           # target catalogs
├── fr.json
├── ja.json
├── .meta.json        # per-key context, description, occurrences
└── .cache/
    └── <16-hex>.json # per-(source, target, provider) cache
```

## Switch locales at runtime

Pass the active locale to the provider:

```tsx
import { T, TranslationProvider } from '@autotranslate/react';
import { useState } from 'react';
import { catalogs } from './catalogs';

export function App() {
  const [locale, setLocale] = useState('en');
  return (
    <TranslationProvider locale={locale} catalog={catalogs[locale]}>
      <T>Hello, world!</T>
    </TranslationProvider>
  );
}
```

How `catalogs` is loaded depends on your bundler:

- **Vite** — use the [Vite plugin](frameworks/vite.md) for a virtual module.
- **Next.js / RSC** — use [`getT`](frameworks/nextjs.md) on the server.
- **Anything else** — `import { catalogs } from './catalogs.json'` works fine.

## Generate types

Make `useT` reject unknown keys at compile time:

```bash
npx autotranslate generate-types
```

This emits `.translations/types.d.ts`, augmenting `@autotranslate/react` with
the literal key set. Add it to your `tsconfig.json` `include`:

```jsonc
{
  "include": ["src", ".translations/types.d.ts"],
}
```

See the [type-safety guide](guides/type-safety.md) for the full setup.

## Verify

```bash
npx autotranslate check
```

Reports keys missing in target locales, orphan keys, and ICU parse errors. Wire
it into CI to keep catalogs in sync.

## Next steps

- **[Translating JSX](guides/translating-jsx.md)** — markers, branches,
  whitespace, context hints.
- **[Translating strings](guides/translating-strings.md)** — `useT`,
  `useTranslations`, dictionary mode.
- **[Providers](guides/providers.md)** — AI, DeepL, Google, custom.
- **[Type safety](guides/type-safety.md)** — narrow `useT` keys, locale unions,
  ICU param inference.
- **[Next.js](frameworks/nextjs.md)** or **[Vite](frameworks/vite.md)** —
  framework setup.
