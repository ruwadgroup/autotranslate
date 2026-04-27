# Next.js

`@autotranslate/next` covers everything Next-specific: locale routing in
`proxy.ts`, server-component translation via `getT`, and a Next config wrapper
for future build-time hooks.

> Targets **Next.js 16+**. The `proxy` file convention replaces `middleware`,
> route `params` are async, and the `react-server` export condition is wired so
> client / server entries swap automatically.

## Install

```bash
pnpm add @autotranslate/next @autotranslate/react @autotranslate/core
```

## Subpath entries

| Entry                            | Purpose                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `@autotranslate/next`            | `getT`, `getTranslations`, `getRequestLocale`, `fsCatalogLoader`, `clearCatalogCache` |
| `@autotranslate/next/middleware` | `createNextMiddleware()` for `proxy.ts`                                               |
| `@autotranslate/next/plugin`     | `withAutotranslate()` Next config wrapper                                             |

## Locale routing

### Path-prefix strategy (default)

```ts
// proxy.ts
import { createNextMiddleware } from '@autotranslate/next/middleware';

export default createNextMiddleware({
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr', 'ja'],
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

The proxy resolves the active locale from path → cookie → `Accept-Language`,
redirects bare paths under `/<locale>/...`, and pushes the resolved locale
downstream via the `x-autotranslate-locale` request header.

By default the default-locale prefix is stripped (e.g. `/dashboard` not
`/en/dashboard`). Pass `prefixDefaultLocale: true` to keep it.

### Cookie strategy

```ts
export default createNextMiddleware({
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr', 'ja'],
  strategy: 'cookie',
  cookieName: 'NEXT_LOCALE', // default
});
```

Paths stay unchanged. The proxy reads `cookieName` and falls through to
`Accept-Language`. Useful for SPAs that already manage routing client-side.

### Reading the resolved locale

```tsx
import { getRequestLocale } from '@autotranslate/next';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  return <html lang={locale ?? 'en'}>{children}</html>;
}
```

`getRequestLocale()` reads the `x-autotranslate-locale` header set by the proxy.
Returns `undefined` when the proxy didn't run (e.g. a route matched out of the
proxy's matcher).

## App Router

### Layout

```tsx
// app/[lang]/layout.tsx
import { fsCatalogLoader } from '@autotranslate/next';
import { TranslationProvider } from '@autotranslate/react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'ja'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const hasLocale = (v: string): v is Locale =>
  (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(v);

const load = fsCatalogLoader(process.cwd(), '.translations');

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const [catalog, fallback] = await Promise.all([load(lang), load('en')]);

  return (
    <html lang={lang}>
      <body>
        <TranslationProvider
          locale={lang}
          catalog={catalog}
          fallback={fallback}
        >
          {children}
        </TranslationProvider>
      </body>
    </html>
  );
}
```

`fsCatalogLoader` reads `<cwd>/<outDir>/<locale>.json` and memoizes per (cwd,
outDir, locale) — Next may call it on every server render, so the parse cost is
paid once per process.

### Server-component translation

```tsx
// app/[lang]/page.tsx
import { getT } from '@autotranslate/next';
import { notFound } from 'next/navigation';

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

`getT(locale, options?)` returns a `Translator` bound to `locale`. The default
loader reads `<cwd>/<outDir>/<locale>.json`; pass `options.load` for custom
storage.

### Dictionary mode on the server

```ts
import { getTranslations } from '@autotranslate/next';

const t = await getTranslations(lang, 'dashboard');
t('title'); // → catalog['dashboard.title']
```

Mirrors the client `useTranslations(ns)` hook.

## Edge runtime

The default `fs` loader uses `node:fs/promises` and won't run on the Edge.
Supply a custom loader for edge route handlers:

```ts
// app/api/welcome/route.ts
import { getT } from '@autotranslate/next';
import en from '@/catalogs/en.json' assert { type: 'json' };
import es from '@/catalogs/es.json' assert { type: 'json' };

const catalogs = { en, es } as const;

export const runtime = 'edge';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: 'en' | 'es' }> },
) {
  const { lang } = await params;
  const t = await getT(lang, {
    load: (locale) => catalogs[locale as keyof typeof catalogs] ?? {},
  });
  return new Response(t.t('Welcome'));
}
```

For dynamic locales on the edge, fetch from KV / Edge Config:

```ts
const t = await getT(lang, {
  async load(locale) {
    const blob = await get(`autotranslate:${locale}`);
    return blob ?? {};
  },
});
```

## Next config

```ts
// next.config.ts
import { withAutotranslate } from '@autotranslate/next/plugin';

export default withAutotranslate({
  reactStrictMode: true,
});
```

Today this is a typed pass-through — autotranslate works with stock Next.js. The
wrapper exists as the canonical integration point for future build-time hooks
(typegen on `next build`, catalog inlining, dev HMR).

## Static export

`generateStaticParams` returns one entry per locale and `getT(locale)` resolves
at build time, so `output: 'export'` produces a fully-static multilingual site:

```ts
// next.config.ts
export default withAutotranslate({
  output: 'export',
});
```

Pair with the path-prefix strategy and `prefixDefaultLocale: true` so every
locale lives at a stable URL.

## Tips

- **Pass both `catalog` and `fallback` to the provider.** The runtime tries the
  active locale first, then falls back to source for any keys the catalog
  misses. `fallback` is what shows up before translations catch up.

- **Memoize loaders.** `fsCatalogLoader` already memoizes; if you write your
  own, share it across renders too.

- **Use `getRequestLocale()` for one-off reads.** When you only need to set
  `<html lang>` or read a header, the proxy-supplied locale is cheaper than
  re-parsing `Accept-Language`.

- **Pin the matcher.** The default `/((?!api|_next|.*\\..*).*)` excludes `api`,
  `_next`, and any path with a file extension. Add other excluded prefixes
  (`/admin`, `/health`) as needed.
