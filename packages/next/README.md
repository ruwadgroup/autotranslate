# @autotranslate/next

Next.js integration for autotranslate. Locale routing in `proxy.ts`,
server-component translation via `getT`, and a Next config wrapper that owns the
dev loop and frozen-build check.

> Targets **Next.js 16+**. Route `params` are async and the `react-server`
> export condition is wired so client/server entries swap automatically.

```bash
pnpm add @autotranslate/next
pnpm add -D @autotranslate/cli
npx autotranslate init
```

`init` detects Next.js, AST-edits `next.config.ts`, creates `proxy.ts`, adds
`.translations/types.d.ts` to `tsconfig.json`, and gitignores
`.translations/.cache/`. Apply the printed layout diff (the one manual step),
set your provider key, and start writing copy.

## Subpath entries

| Entry                             | Purpose                                         |
| --------------------------------- | ----------------------------------------------- |
| `@autotranslate/next`             | `getT`, `getRequestLocale`, `clearCatalogCache` |
| `@autotranslate/next/middleware`  | `createNextMiddleware()` for `proxy.ts`         |
| `@autotranslate/next/plugin`      | `withAutotranslate()` Next config wrapper       |
| `@autotranslate/next/auto-loader` | Webpack/Turbopack loader for `mode: 'auto'`     |

## Setup

### 1. Wrap your Next config

```ts
// next.config.ts
import { withAutotranslate } from '@autotranslate/next/plugin';

export default withAutotranslate({
  reactStrictMode: true,
});
```

`withAutotranslate` must be the outermost wrapper. In development it starts a
process-wide dev loop (extract - translate - typegen on each save). At build
time it runs `checkFrozen` - re-extracts source in memory, fails with a precise
list if the committed catalog is out of date. CI needs no API key.

### 2. `proxy.ts`

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

Resolves the active locale from path - cookie - `Accept-Language`, redirects
bare paths under `/<locale>/...`, and pushes the resolved locale downstream via
the `x-autotranslate-locale` header.

### 3. App layout

```tsx
// app/[lang]/layout.tsx
import { TranslationProvider } from '@autotranslate/react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import * as catalogModule from '../../.translations';

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'ja'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const hasLocale = (v: string): v is Locale =>
  (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(v);

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const [catalog, fallback] = await Promise.all([
    catalogModule.loadCatalog(lang),
    catalogModule.loadCatalog('en'),
  ]);

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

`import * as catalogModule from '../../.translations'` loads the generated
`<outDir>/index.ts`. Its `loadCatalog(locale)` uses static `import()` specifiers
so bundlers code-split per locale - no runtime filesystem access, works on edge
runtimes.

### 4. Server-component translation

```tsx
// app/[lang]/page.tsx
import { getT } from '@autotranslate/next';
import * as catalogModule from '../../.translations';

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = await getT(lang, { module: catalogModule, fallback: 'en' });
  return <h1>{t.t('Welcome')}</h1>;
}
```

## Edge runtime

For edge route handlers, pass a custom `load` callback instead of `module`:

```ts
import { getT } from '@autotranslate/next';
import { catalogs } from 'virtual:autotranslate'; // or any KV source

export const runtime = 'edge';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  const t = await getT(lang, {
    load: (locale) => catalogs[locale] ?? {},
  });
  return new Response(t.t('Welcome'));
}
```

## API

### `@autotranslate/next`

- `getT(locale, options)` - `Promise<Translator>`
  - `options.module` - generated catalog module
    (`import * as catalogModule from '<outDir>/index.ts'`); memoized per
    (module, locale)
  - `options.load` - custom `(locale) => Promise<Catalog> | Catalog` for KV,
    Edge Config, etc.
  - `options.fallback` - source locale used on key miss
  - Exactly one of `module` or `load` is required
- `getRequestLocale()` - `Promise<Locale | undefined>` - reads the
  `x-autotranslate-locale` header set by the proxy
- `clearCatalogCache()` - drops the in-process (module, locale) memo; useful in
  tests
- `LOCALE_HEADER` - the header name (`'x-autotranslate-locale'`)

### `@autotranslate/next/plugin`

- `withAutotranslate(nextConfig?, options?)` - Next config wrapper
  - `options.devLoop` - start the dev loop in development; default `true`
  - `options.build.frozen` - fail the build when catalog is out of date; default
    `true`
  - `options.build.translateOnBuild` - translate instead of fail; default
    `false`

### `@autotranslate/next/middleware`

- `createNextMiddleware(options)` - returns a Next proxy function
  - `defaultLocale`, `locales` - required
  - `strategy: 'prefix' | 'cookie'` - default `'prefix'`
  - `cookieName` - default `'NEXT_LOCALE'`
  - `prefixDefaultLocale: boolean` - default `false`

---

Full docs:
[github.com/tamimbinhakim/autotranslate/docs/frameworks/nextjs.md](https://github.com/tamimbinhakim/autotranslate/blob/main/docs/frameworks/nextjs.md)
