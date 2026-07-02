# Migrating from next-intl

`next-intl` is a Next.js-specific i18n library with hand-authored JSON messages
and ICU MessageFormat support. The shape change to autotranslate: code-first
authoring, AI-generated catalogs, same ICU runtime, broader framework reach.

## At a glance

```
// On-disk shape
messages/{locale}.json              // next-intl - handwritten flat file
.translations/{locale}/**.json      // autotranslate - generated, hash-bucketed
```

```ts
// Hook (client) - the literal string IS the key in autotranslate
const t = useTranslations('Cart');
t('checkout'); // next-intl - looks up `Cart.checkout` in the JSON

const t = useT();
t('Check out'); // autotranslate - the literal IS the key
```

```ts
// Server-side
const t = await getTranslations({ locale, namespace: 'Cart' }); // next-intl

import { getT } from '@autotranslate/next'; // autotranslate
const t = await getT(locale, { module: catalogModule });
```

```tsx
// Provider
<NextIntlClientProvider messages={messages}>;             // next-intl
<TranslationProvider locale={locale} catalog={catalog}>;  // autotranslate
```

```ts
// Locale routing
import createMiddleware from 'next-intl/middleware'; // next-intl
import { createNextMiddleware } from '@autotranslate/next/middleware'; // autotranslate
//   same prefix / cookie strategies, same default cookie name
```

```tsx
// Rich text
t.rich('welcome', { brand: (chunks) => <strong>{chunks}</strong> }); // next-intl
<T>
  Welcome to <strong>autotranslate</strong>
</T>; // autotranslate - <T> walks children, hashes the tree
```

ICU MessageFormat works identically. The same syntax applies for plurals,
select, and placeholders. The catalog values just live in a different file
shape.

## The fast path: `mode: 'auto'`

Before manually wrapping every string, consider enabling `mode: 'auto'` in your
config. With auto mode, the compiler wraps JSX text nodes in `<T>` at compile
time so you do not touch existing components at all.

```ts
// autotranslate.config.ts
export default defineConfig({
  mode: 'auto',
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/**/*.{ts,tsx}'],
});
```

Your existing JSX stays unchanged. Opt out of auto-wrapping on specific elements
with `data-no-translate`. See
[Configuration](../reference/configuration.md#mode).

## Step-by-step

### 1. Replace runtime

```bash
pnpm remove next-intl
pnpm add @autotranslate/react @autotranslate/core @autotranslate/next
pnpm add -D @autotranslate/cli
npx autotranslate init
```

### 2. Move existing translations into `overrides`

Convert each `messages/{locale}.json` into entries under the matching locale in
`overrides`. The keys become the source-locale string, not the dotted path:

```ts
// before: messages/fr.json
{ "Cart": { "checkout": "Passer la commande" } }
// where en.json had: { "Cart": { "checkout": "Check out" } }

// after: autotranslate.config.ts
overrides: {
  fr: {
    'Check out': 'Passer la commande',
  },
}
```

### 3. Replace the proxy / middleware

```ts
// before - middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'es', 'fr', 'ja'],
  defaultLocale: 'en',
});

// after - proxy.ts (Next.js 16+)
import { createNextMiddleware } from '@autotranslate/next/middleware';

export default createNextMiddleware({
  locales: ['en', 'es', 'fr', 'ja'],
  defaultLocale: 'en',
  // strategy: 'cookie',  // optional; default is 'prefix'
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

The proxy resolves locale from path -> cookie -> `Accept-Language` and passes it
downstream via the `x-autotranslate-locale` header. The mental model is the same
as next-intl, with the same path-prefix behavior by default.

### 4. Replace the provider

```tsx
// before - app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function Layout({ children, params }) {
  const { locale } = await params;
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

// after - app/[locale]/layout.tsx
import { TranslationProvider } from '@autotranslate/react';
import * as catalogModule from '../../.translations';

export default async function Layout({ children, params }) {
  const { locale } = await params;
  const [catalog, fallback] = await Promise.all([
    catalogModule.loadCatalog(locale),
    catalogModule.loadCatalog('en'),
  ]);
  return (
    <TranslationProvider locale={locale} catalog={catalog} fallback={fallback}>
      {children}
    </TranslationProvider>
  );
}
```

`import * as catalogModule from '../../.translations'` imports the generated
`<outDir>/index.ts` module. Its `loadCatalog(locale)` uses static `import()` so
the bundler code-splits per locale - no filesystem access at request time.

### 5. Replace string translation

```tsx
// before
const t = useTranslations('Cart');
t('checkout');
t('items', { count });

// after
import { useT } from '@autotranslate/react';
const t = useT();
t('Check out');
t('{count, plural, one {# item} other {# items}}', { count });
```

The literal string is both the key and the English fallback. Use `$context` to
disambiguate identical strings that appear in different screens:

```ts
t('Submit', { $context: 'cart action' });
t('Submit', { $context: 'settings action' });
```

### 6. Replace rich text

```tsx
// before
t.rich('welcome', {
  brand: (chunks) => <strong>{chunks}</strong>,
});
// JSON: { "welcome": "Welcome to <brand>autotranslate</brand>" }

// after
import { T } from '@autotranslate/react';
<T>
  Welcome to <strong>autotranslate</strong>
</T>;
```

`<T>` walks its children, hashes them, and looks the tree up at runtime. No
`t.rich()` API is needed.

### 7. Server components

```tsx
// before
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('Cart');

// after
import { getT } from '@autotranslate/next';
import * as catalogModule from '../../.translations';
const t = await getT(locale, { module: catalogModule });
t.t('Check out');
```

### 8. Replace formatters

```tsx
// before
import { useFormatter } from 'next-intl';
const f = useFormatter();
f.dateTime(date);
f.number(price, { style: 'currency', currency: 'USD' });

// after
import { DateTime, Currency } from '@autotranslate/react';
<DateTime value={date} />
<Currency value={price} currency="USD" />
```

Inside `<T>` they integrate as opaque slots. Outside `<T>` they format
standalone using `Intl.*` and the active locale.

### 9. Run the pipeline

```bash
npx autotranslate extract
npx autotranslate translate
npx autotranslate generate-types
```

## Things to know

- **next-intl namespaces** - autotranslate does not have namespace-prefixed
  hooks; the literal string is the key. Use `$context` to distinguish identical
  strings across screens, and `$description` to pass translator guidance.
- **`getMessages()` vs. catalog module** - both deliver JSON to the provider.
  The generated module uses static `import()` for bundler code-splitting, which
  avoids `outputFileTracingIncludes` wiring and works on edge runtimes.
- **Cookie name** - next-intl's default is `NEXT_LOCALE`. autotranslate's
  `createNextMiddleware` also defaults to `NEXT_LOCALE`, so you can keep the
  same cookie for a smooth migration.
- **`<Link locale>` from next-intl** - autotranslate does not ship a typed Link
  wrapper today. Use Next.js's `<Link>` directly with prefixed paths
  (`/fr/...`); the proxy strips the prefix in route params.
- **Pages Router** - autotranslate targets App Router (Next 13.4+). For Pages
  Router, use `@autotranslate/react` directly with manual catalog loading.

## Next

- [Quick start](../quick-start.md)
- [Next.js framework guide](../frameworks/nextjs.md)
- [Locale switcher cookbook](../cookbook/locale-switcher.md)
