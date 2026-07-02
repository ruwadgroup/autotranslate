# Next.js

`@autotranslate/next` covers everything Next-specific: locale routing in
`proxy.ts`, server-component translation via `getT`, and a phase-aware Next
config wrapper that drives the dev loop and frozen-build check automatically.

> Targets **Next.js 16+**. The `proxy` file convention replaces `middleware`,
> route `params` are async, and the `react-server` export condition is wired so
> client/server entries swap automatically.

## Setup

Run `init` once - it wires everything:

```bash
pnpm add @autotranslate/next
pnpm add -D @autotranslate/cli
npx autotranslate init
```

`init` detects Next.js, AST-edits `next.config.ts` to wrap the default export in
`withAutotranslate`, creates `proxy.ts`, adds `.translations/types.d.ts` to
`tsconfig.json`, and gitignores `.translations/.cache/`. Apply the printed
layout diff (the one manual step), set your provider key, and start writing
copy.

## `withAutotranslate`

`withAutotranslate` must be the outermost wrapper in `next.config.ts`:

```ts
// next.config.ts
import { withAutotranslate } from '@autotranslate/next/plugin';

export default withAutotranslate({
  reactStrictMode: true,
});
```

It returns an async function config so Next.js calls it with the current build
phase. Use `withAutotranslate` as the outermost wrapper; inner wrappers like
`withSentryConfig` go inside it.

### Phase behavior

**Development (`phase-development-server`):** starts a process-wide dev loop
singleton (guarded by a `globalThis` symbol so re-evaluations don't double-start
it). The loop watches your `config.content` globs with chokidar, debounces
150ms, then runs extract → translate → generate-types on each save. New strings
appear in the running app without any manual command. Provider errors are logged
and silently skipped; the dev server never crashes.

**Production build (`phase-production-build`):** runs `checkFrozen` in memory —
re-extracts your source, compares against the committed catalog, and throws with
a precise list if anything is missing. The model is never called at build time.
CI needs no API key.

If `@autotranslate/cli` is not installed, both phases warn once and continue
(the plugin degrades gracefully).

### Options

```ts
withAutotranslate(nextConfig, {
  devLoop: true, // set false to disable the dev loop (rarely needed)
  build: {
    frozen: true, // default — fail build on missing strings
    translateOnBuild: false, // set true to translate instead of failing
  },
});
```

| Option                   | Default | Description                                         |
| ------------------------ | ------- | --------------------------------------------------- |
| `devLoop`                | `true`  | Whether to start the dev loop in development.       |
| `build.frozen`           | `true`  | Whether to check the catalog is complete at build.  |
| `build.translateOnBuild` | `false` | Translate missing strings at build instead of fail. |

Config-file `build` settings (`autotranslate.config.ts`) are the source of truth
when these options are not supplied to `withAutotranslate`.

### Auto mode (mode: 'auto')

When `mode: 'auto'` is set in `autotranslate.config.ts`, `withAutotranslate`
registers `@autotranslate/next/auto-loader` for all `*.{jsx,tsx}` files (webpack
and turbopack) so JSX text is wrapped in `<T>` at compile time. This means you
can write plain JSX and have it translated without manual markers. See
[Configuration](../reference/configuration.md#mode).

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
downstream via the `x-autotranslate-locale` request header. By default the
default-locale prefix is stripped (e.g. `/dashboard` not `/en/dashboard`). Pass
`prefixDefaultLocale: true` to keep it.

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
Returns `undefined` when the proxy did not run.

## App Router

### Layout

The generated `<outDir>/index.ts` module is how catalogs reach the layout.
`init` prints a manual diff to create `app/[lang]/layout.tsx` - here is the
canonical shape:

```tsx
// app/[lang]/layout.tsx
import { TranslationProvider } from '@autotranslate/react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import * as catalogModule from '../../.translations';

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'ja'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const hasLocale = (value: string): value is Locale =>
  (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(value);

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

`import * as catalogModule from '../../.translations'` imports the generated
`<outDir>/index.ts` file produced on extract. Its `loadCatalog(locale)` uses
static `import()` specifiers so the bundler can code-split per locale - no
runtime filesystem access and no `outputFileTracingIncludes` wiring needed.

### Server-component translation

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

`getT(locale, options)` returns a `Translator` bound to `locale`. Pass
`{ module: catalogModule }` (the generated `<outDir>/index.ts`) for bundled
catalog delivery, or `{ load }` for a custom source such as KV or Edge Config.
`fsCatalogLoader` has been removed - the generated module is the only supported
catalog source for standard use.

## Subpath entries

| Entry                             | Purpose                                     |
| --------------------------------- | ------------------------------------------- |
| `@autotranslate/next`             | `getT`, `getRequestLocale`                  |
| `@autotranslate/next/middleware`  | `createNextMiddleware()` for `proxy.ts`     |
| `@autotranslate/next/plugin`      | `withAutotranslate()` Next config wrapper   |
| `@autotranslate/next/auto-loader` | webpack/turbopack loader for `mode: 'auto'` |

## Server Actions

For Server Actions that run validators or other code expecting the standalone
`t()`, wrap with `withRequestTranslator` from `@autotranslate/zod/next`:

```ts
'use server';

import { withRequestTranslator } from '@autotranslate/zod/next';

export async function signUp(formData: FormData) {
  return withRequestTranslator(async () => {
    const data = signUpSchema.parse(Object.fromEntries(formData));
    // …
  });
}
```

See [Server Actions cookbook](../cookbook/server-actions.md).

## Edge runtime

Because catalogs are loaded via static `import()` specifiers in the generated
module, they are bundled at build time and never read from the filesystem at
request time. The module-based path works on edge runtimes with zero extra
configuration.

For custom catalog sources (KV, Edge Config), pass a `load` callback to `getT`:

```ts
// app/api/welcome/route.ts
import { getT } from '@autotranslate/next';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  const t = await getT(lang, {
    load: (locale) => fetchFromEdgeKv(locale),
  });
  return new Response(t.t('Welcome'));
}
```

See [Lazy-loading](../cookbook/lazy-loading.md).

## Static export

`generateStaticParams` returns one entry per locale and `loadCatalog` resolves
at build time, so `output: 'export'` produces a fully-static multilingual site:

```ts
export default withAutotranslate({
  output: 'export',
});
```

Pair with the path-prefix strategy and `prefixDefaultLocale: true` so every
locale lives at a stable URL.

## Tips

- **`withAutotranslate` must be outermost.** Inner wrappers run before
  autotranslate sees the phase, so loaders and the dev loop are registered last.
- **Pass both `catalog` and `fallback` to the provider.** The runtime tries the
  active locale first, then falls back to source for any keys the catalog
  misses.
- **Pin the matcher.** The default `/((?!api|_next|.*\\..*).*)` excludes `api`,
  `_next`, and any path with a file extension. Add other excluded prefixes
  (`/admin`, `/health`) as needed.
- **Inlay hints.** Install `@autotranslate/typescript-plugin` to see translated
  values inline in your editor for every `t('...')` call.
