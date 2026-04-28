# Migrating from next-intl

`next-intl` is a Next.js–specific i18n library with hand-authored JSON messages
and ICU MessageFormat support. The shape change to autotranslate: **code-first
authoring, AI-generated catalogs, same ICU runtime, broader framework reach**.

## At a glance

```
// On-disk shape
messages/{locale}.json         // next-intl — handwritten
.translations/{locale}/**.json // autotranslate — generated
```

```ts
// Hook (client) — same name, different argument semantics
const t = useTranslations('Cart');
t('checkout'); // next-intl — looks up `Cart.checkout` in the JSON
t('Check out'); // autotranslate — the literal IS the key (or namespaced via dictionary)
```

```ts
// Server-side
const t = await getTranslations({ locale, namespace: 'Cart' }); // next-intl
const t = await getTranslations(locale, 'Cart'); // autotranslate
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
//   ↑ same API shape — same `prefix` / `cookie` strategies
```

```tsx
// Rich text
t.rich('welcome', { brand: (chunks) => <strong>{chunks}</strong> }); // next-intl
<T>
  Welcome to <strong>autotranslate</strong>
</T>; // autotranslate
//   ↑ <T> walks children, hashes the tree, no `t.rich` API needed
```

ICU MessageFormat works identically — same syntax for plurals / select /
placeholders. The cataloged values just live in a different file shape.

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
`overrides`. The keys become the **source-locale string**, not the dotted path:

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

For dictionary-mode users keeping the namespace structure, see step 5 below.

### 3. Replace the proxy / middleware

```ts
// before — middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'es', 'fr', 'ja'],
  defaultLocale: 'en',
});

// after — proxy.ts (Next.js 16+) or middleware.ts (Next.js 15)
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

The proxy resolves locale from path → cookie → `Accept-Language` and attaches
the resolved locale via `x-autotranslate-locale` header. Same mental model as
next-intl, with the same path-prefix behaviour by default.

### 4. Replace the provider

```tsx
// before — app/[locale]/layout.tsx
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

// after — app/[locale]/layout.tsx
import { fsCatalogLoader } from '@autotranslate/next';
import { TranslationProvider } from '@autotranslate/react';

const load = fsCatalogLoader(process.cwd(), '.translations');

export default async function Layout({ children, params }) {
  const { locale } = await params;
  const [catalog, fallback] = await Promise.all([load(locale), load('en')]);
  return (
    <TranslationProvider locale={locale} catalog={catalog} fallback={fallback}>
      {children}
    </TranslationProvider>
  );
}
```

### 5. Replace string translation

```tsx
// before
const t = useTranslations('Cart');
t('checkout');
t('items', { count });

// after, inline-string style (preferred)
const t = useT();
t('Check out');
t('{count, plural, one {# item} other {# items}}', { count });

// after, dictionary mode (closest to next-intl pattern)
// 1. autotranslate.config.ts:
//      dictionary: 'src/dictionary.ts'
// 2. src/dictionary.ts:
//      export default { Cart: { checkout: 'Check out', items: '...' } };
// 3. component:
const td = useTranslations('Cart');
td('checkout');
```

If your codebase relies heavily on namespaces, dictionary mode keeps the
`useTranslations('Cart')` shape working. If you'd rather drop the keypath
system, use `useT()` everywhere and let the literal strings be the keys.

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

`<T>` walks its children, hashes them, and looks the tree up at runtime — no
`t.rich()` API needed. Tags, components, attributes all flow through naturally.

### 7. Server components

```tsx
// before
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('Cart');

// after
import { getTranslations } from '@autotranslate/next';
const t = await getTranslations(locale, 'Cart');
```

### 8. Replace formatters

```tsx
// before
import { useFormatter } from 'next-intl';
const f = useFormatter();
f.dateTime(date);
f.number(price, { style: 'currency', currency: 'USD' });

// after
import { DateTime, Currency, Num } from '@autotranslate/react';
<DateTime value={date} />
<Currency value={price} currency="USD" />
```

Inside `<T>` they integrate as opaque slots; outside `<T>` they format
standalone using `Intl.*` and the active locale.

### 9. Run the pipeline

```bash
pnpm i18n   # autotranslate extract && translate && generate-types
```

## Things to know

- **next-intl namespaces `Cart.checkout`** vs **autotranslate dictionary
  `Cart.checkout`**: both map to `dot.path` keys. If you keep dictionary mode,
  the migration is mostly mechanical.
- **`getMessages()` vs `fsCatalogLoader`**: both read JSON from disk and
  memoize. autotranslate's loader is fully customizable for KV / Edge Config —
  see the [lazy-loading cookbook](../cookbook/lazy-loading.md).
- **Cookie name**: next-intl's default is `NEXT_LOCALE`. autotranslate accepts
  `cookieName` in `createNextMiddleware`; default is also `NEXT_LOCALE`, so you
  can keep the same cookie if you want a smooth migration.
- **`<Link locale>` from next-intl**: autotranslate doesn't ship a typed Link
  wrapper today. Use Next.js's `<Link>` directly with prefixed paths (`/fr/...`)
  — the proxy strips the prefix in `params`.
- **Pages Router**: next-intl's Pages Router setup doesn't translate cleanly.
  autotranslate targets App Router (Next 13.4+); for Pages Router we recommend
  using `@autotranslate/react` directly with manual catalog loading.

## Next

- [Quick start](../quick-start.md)
- [Next.js framework guide](../frameworks/nextjs.md)
- [Locale switcher cookbook](../cookbook/locale-switcher.md)
