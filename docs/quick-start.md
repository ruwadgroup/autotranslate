# Quick start

Five minutes from empty project to a translated React app.

## 1. Install

```bash
pnpm add @autotranslate/react @autotranslate/core
pnpm add -D @autotranslate/cli
```

## 2. Configure

```bash
npx autotranslate init
```

Edit the generated `autotranslate.config.ts`:

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

Set the env var matching your provider, then install the SDK:

```bash
export ANTHROPIC_API_KEY=sk-ant-…
pnpm add ai @ai-sdk/anthropic
```

## 3. Wrap your app

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

`<T>` walks its children, derives a stable key, and renders the translated tree
at runtime. Without a provider, the runtime falls back to the source — no
errors, no warnings.

## 4. Add a few real strings

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
  describe the dynamic slots.
- `useT()` for plain strings — button labels, `aria-*`, programmatic copy.

## 5. Translate

```bash
npx autotranslate translate
```

The CLI scans `config.content`, builds the canonical English catalog, diffs
against the cache, and translates only what changed.

```
.translations/
├── en.json           # source
├── es.json           # AI-translated
├── fr.json
├── ja.json
├── .meta.json        # context, descriptions, occurrences
└── .cache/           # per-(source, target, provider) diff cache
```

## 6. Switch locales at runtime

```tsx
import { TranslationProvider } from '@autotranslate/react';
import { useState } from 'react';
import en from '../.translations/en.json';
import es from '../.translations/es.json';
import fr from '../.translations/fr.json';
import ja from '../.translations/ja.json';

const catalogs = { en, es, fr, ja };

export function App() {
  const [locale, setLocale] = useState<keyof typeof catalogs>('en');
  return (
    <TranslationProvider
      locale={locale}
      catalog={catalogs[locale]}
      fallback={en}
    >
      {/* …app… */}
    </TranslationProvider>
  );
}
```

How `catalogs` is loaded depends on your bundler:

- **Vite** — use the [Vite plugin](frameworks/vite.md) for a virtual module with
  HMR.
- **Next.js / RSC** — use [`getT(locale)`](frameworks/nextjs.md) on the server.
- **Anything else** — direct JSON imports work fine.

## 7. Generate types (optional but recommended)

```bash
npx autotranslate generate-types
```

After this, `useT('Sing out')` is a TypeScript error. Reference the generated
file from your `tsconfig.json`:

```jsonc
{
  "include": ["src", ".translations/types.d.ts"],
}
```

## 8. Verify in CI

```bash
npx autotranslate check
```

Reports keys missing in target locales, orphan keys, and ICU parse errors. Exits
non-zero on any problem — wire it into your pipeline.

## What's next

- **[Concepts](concepts.md)** — how keys, catalogs, locales, and ICU fit
  together
- **[JSX translation](guides/jsx.md)** — markers, plurals, branches, tag
  wrappers
- **[Type safety](guides/typesafety.md)** — narrow `useT` keys
- **[Next.js](frameworks/nextjs.md)** or **[Vite](frameworks/vite.md)** —
  framework setup
- **[Cookbook](README.md#cookbook)** — recipes for real patterns
