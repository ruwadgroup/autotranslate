# String translation

`useT` is the hook for plain-string translation - button labels, `aria-*`
attributes, programmatic copy.

```tsx
import { useT } from '@autotranslate/react';

function SignOutButton() {
  const t = useT();
  return <button type="button">{t('Sign out')}</button>;
}
```

`useT()` returns `(key, params?) => string` bound to the active locale and
catalog. The literal string is both the source and the catalog key.

## ICU placeholders

Keys are ICU MessageFormat templates:

```tsx
const t = useT();

t('Hello, {name}!', { name: 'Ada' });
// -> 'Hello, Ada!' (en) / '¡Hola, Ada!' (es) / 'Adaさん、こんにちは！' (ja)

t('{count, plural, one {# message} other {# messages}}', { count: 3 });
// -> '3 messages' (en)
```

The full ICU subset - `plural`, `select`, `number`, `date`, `time`, tag
wrappers - is supported.

## Disambiguating with context

```tsx
t('Submit', { $context: 'navbar action' });
t('Submit', { $context: 'form button' });
```

The CLI extracts each as a separate entry (`Submit@@navbar action`,
`Submit@@form button`).

Reserved option keys (consumed by the translator, not the formatter):

| Key            | Effect                                                  |
| -------------- | ------------------------------------------------------- |
| `$context`     | Suffix appended to the key (`<key>@@<context>`).        |
| `$description` | Translator-facing description. Stored in `.meta.json`.  |
| `$maxChars`    | Soft length budget. Passed to AI providers as guidance. |

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

For RSC and route handlers in Next.js:

```tsx
import { getT } from '@autotranslate/next';
import * as catalogModule from '../../.translations';

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = await getT(lang, { module: catalogModule });
  return <h1>{t.t('Welcome')}</h1>;
}
```

In other server frameworks (Remix, Hono, Bun, edge handlers):

```tsx
import { getT } from '@autotranslate/react/server';

const t = await getT('es', () => loadCatalog('es'));
return <h1>{t.t('Welcome')}</h1>;
```

## Outside React

For zod errors, validators, async work, and tests, use the
[standalone `t()`](standalone-t.md) - same catalog, no React dependency.

## Tips

- **Keep keys short, idiomatic, and natural.** They double as fallbacks when the
  catalog misses.

- **Avoid string concatenation.** `t('Hello') + ' ' + name` strips the
  punctuation context - translators can't move it. Use a single key:
  `t('Hello, {name}!', { name })`.

- **Catch dynamic keys at lint time.** The [`no-dynamic-key`](linting.md) ESLint
  rule rejects `t(variable)` and ``t(`prefix.${id}`)`` because the extractor
  can't follow them.

- **Generate types.** After [`autotranslate generate-types`](typesafety.md),
  `useT('Sing out')` becomes a TypeScript error.
