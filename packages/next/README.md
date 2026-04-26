# @autotranslate/next

Next.js integration for autotranslate. Locale detection in `proxy.ts`, server
helpers for App Router pages, and a Next config wrapper.

> Targets **Next.js 16+**. The `proxy` file convention replaces `middleware`;
> route `params` are async; this package follows those.

```bash
pnpm add @autotranslate/next @autotranslate/react @autotranslate/core
```

## Subpath entries

| Entry                            | Purpose                                       |
| -------------------------------- | --------------------------------------------- |
| `@autotranslate/next`            | `getT`, `getRequestLocale`, `fsCatalogLoader` |
| `@autotranslate/next/middleware` | `createNextMiddleware()` for `proxy.ts`       |
| `@autotranslate/next/plugin`     | `withAutotranslate()` Next config wrapper     |

## Setup

### 1. `proxy.ts`

```ts
// proxy.ts (was middleware.ts in Next 15)
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
redirects bare paths under `/<locale>/...` (or sets a cookie when
`strategy: 'cookie'`), and pushes the resolved locale downstream via the
`x-autotranslate-locale` request header.

### 2. App layout

```tsx
// app/[lang]/layout.tsx
import { TranslationProvider } from '@autotranslate/react';
import { getT } from '@autotranslate/next';

export default async function Layout({
  children,
  params,
}: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  const [t, fallback] = await Promise.all([getT(lang), getT('en')]);
  return (
    <html lang={lang}>
      <body>
        <TranslationProvider
          locale={lang}
          catalog={(t as { raw: typeof t.raw }).raw ? {} : {}}
        >
          {children}
        </TranslationProvider>
      </body>
    </html>
  );
}
```

### 3. Server-component translation

```tsx
// app/[lang]/page.tsx
import { getT } from '@autotranslate/next';

export default async function Page({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  const t = await getT(lang, { fallback: 'en' });
  return <h1>{t.t('Welcome')}</h1>;
}
```

## Public API

### `@autotranslate/next`

- `getT(locale, options?)` → `Promise<Translator>`
  - `options.load`: custom `(locale) => Promise<Catalog> | Catalog` for edge /
    KV / network strategies.
  - `options.fallback`: source locale used when a key is missing in `locale`.
  - `options.outDir`, `options.cwd`: override the fs loader's defaults.
- `getRequestLocale()` → `Promise<Locale | undefined>` — reads the
  `x-autotranslate-locale` header set by the proxy.
- `fsCatalogLoader(cwd, outDir)` — the default loader, exposed for callers that
  want to compose it.
- `clearCatalogCache()` — drops the in-process loader cache (tests, HMR).
- `LOCALE_HEADER` — the header name proxy and `getRequestLocale` agree on.

### `@autotranslate/next/middleware`

- `createNextMiddleware(options)` → Next `proxy` function
  - `defaultLocale`, `locales` (required)
  - `strategy: 'prefix' | 'cookie'` (default `'prefix'`)
  - `cookieName` (default `'NEXT_LOCALE'`)
  - `prefixDefaultLocale: boolean` (default `false` — keep the default locale's
    URLs at the root)

### `@autotranslate/next/plugin`

- `withAutotranslate(nextConfig)` — typed pass-through today; the canonical
  integration point for build-time hooks (typegen, catalog inlining) in later
  versions.

## Edge runtime

The default `getT` uses `node:fs/promises` and won't run on the Edge. For edge
route handlers, supply a custom loader:

```ts
import { getT } from '@autotranslate/next';
import en from '../catalogs/en.json' assert { type: 'json' };
import es from '../catalogs/es.json' assert { type: 'json' };

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
