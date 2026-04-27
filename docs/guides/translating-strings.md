# Translating strings

`useT` is the hook for plain-string translation — button labels, `aria-*`
attributes, programmatic copy, anything that isn't JSX.

## Basic usage

```tsx
import { useT } from '@autotranslate/react';

function SignOutButton() {
  const t = useT();
  return <button type="button">{t('Sign out')}</button>;
}
```

`useT()` returns `(key, params?) => string` bound to the active locale and
catalog. The literal string is both the source and the catalog key — the
extractor picks it up at build time.

## ICU placeholders

Keys are ICU MessageFormat templates. Pass values via `params`:

```tsx
const t = useT();

t('Hello, {name}!', { name: 'Ada' });
// → 'Hello, Ada!' (en) / '¡Hola, Ada!' (es) / 'Adaさん、こんにちは！' (ja)
```

Plurals work the same way:

```tsx
t('{count, plural, one {# message} other {# messages}}', { count: 3 });
// → '3 messages' (en)
```

The full ICU subset — `plural`, `select`, `number`, `date`, `time`, `tag`
wrappers — is supported. See
[`@autotranslate/core/icu`](../api-reference.md#autotranslatecoreicu).

## Disambiguating with context

Identical strings in different contexts get different translations. Reserved
option keys (consumed by the translator, not the formatter):

```tsx
t('Submit', { $context: 'navbar action' });
t('Submit', { $context: 'form button' });
```

The CLI extracts each as a separate entry (`Submit@@navbar action`,
`Submit@@form button`).

Other reserved keys:

| Key            | Effect                                                  |
| -------------- | ------------------------------------------------------- |
| `$context`     | Suffix appended to the key (`<key>@@<context>`).        |
| `$description` | Translator-facing description. Stored in `.meta.json`.  |
| `$maxChars`    | Soft length budget. Passed to AI providers as guidance. |

## `useTranslations` (dictionary mode)

When you'd rather organize copy in a flat dictionary file than inline literals,
use `useTranslations(namespace)`:

```ts
// src/dictionary.ts
export default {
  dashboard: {
    title: 'Dashboard',
    greeting: 'Welcome, {name}!',
  },
  cta: {
    signIn: 'Sign in',
    signUp: 'Sign up',
  },
};
```

```ts
// autotranslate.config.ts
export default defineConfig({
  // …
  dictionary: 'src/dictionary.ts',
});
```

```tsx
import { useTranslations } from '@autotranslate/react';

function Dashboard({ user }: { user: User }) {
  const t = useTranslations('dashboard');
  return (
    <>
      <h1>{t('title')}</h1>
      <p>{t('greeting', { name: user.name })}</p>
    </>
  );
}
```

`useTranslations(ns)` is sugar over `useT()` — it prefixes every lookup with
`<ns>.`. The CLI flattens the dictionary tree into `dot.path` keys during
extraction so it lines up with your runtime calls.

Pass an empty string (or omit the argument) to address keys at the dictionary
root.

## `useLocale`

Returns the active locale string. Re-renders when the provider changes it.

```tsx
import { useLocale } from '@autotranslate/react';

function Footer() {
  const locale = useLocale();
  return <span>Active locale: {locale}</span>;
}
```

## On the server

For RSC and route handlers, use the async factory from the server entry:

```tsx
import { getT } from '@autotranslate/react/server';

export default async function Page() {
  const t = await getT('es', () => loadCatalog('es'));
  return <h1>{t.t('Welcome')}</h1>;
}
```

Or in Next.js with the bundled fs loader:

```tsx
import { getT } from '@autotranslate/next';

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = await getT(lang, { fallback: 'en' });
  return <h1>{t.t('Welcome')}</h1>;
}
```

`getTranslations` mirrors `useTranslations` for namespace-prefixed lookups:

```ts
import { getTranslations } from '@autotranslate/next';

const t = await getTranslations(lang, 'dashboard');
t('title'); // → catalog['dashboard.title']
```

## Tips

- **Keep keys short, idiomatic, and natural.** They double as fallbacks when the
  catalog misses.

- **Avoid string concatenation.** `t('Hello') + ' ' + name` strips the
  punctuation context — translators can't move it. Use a single key with a
  placeholder: `t('Hello, {name}!', { name })`.

- **Catch dynamic keys at lint time.** The [`no-dynamic-key`](eslint.md) ESLint
  rule rejects `t(variable)` and `t(\`prefix.${id}\`)` because the extractor
  can't follow them.

- **Generate types.** After [`autotranslate generate-types`](type-safety.md),
  `useT('Sing out')` becomes a TypeScript error.
