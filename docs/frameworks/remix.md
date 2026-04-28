# Remix / React Router 7+

Remix doesn't need a dedicated package — loaders + actions consume
`@autotranslate/react` and the standalone `t()` directly.

## Install

```bash
pnpm add @autotranslate/react @autotranslate/core
pnpm add -D @autotranslate/cli
```

For translated Zod errors:

```bash
pnpm add @autotranslate/zod
```

## Resolve the locale

A typical Remix root pulls from cookie or `Accept-Language`:

```ts
// app/utils/locale.server.ts
import { matchLocale } from '@autotranslate/core/locale';

export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'ja'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function resolveLocale(request: Request): SupportedLocale {
  const cookie = request.headers.get('cookie') ?? undefined;
  const accept = request.headers.get('accept-language') ?? undefined;
  const matched = matchLocale({
    accept,
    cookie,
    defaultLocale: 'en',
    supported: SUPPORTED_LOCALES,
  });
  return matched as SupportedLocale;
}
```

`matchLocale` checks path → cookie → `Accept-Language` → default in that order.

## Load the catalog

```ts
// app/utils/catalog.server.ts
import type { Catalog } from '@autotranslate/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const cache = new Map<string, Catalog>();

export async function loadCatalog(locale: string): Promise<Catalog> {
  const cached = cache.get(locale);
  if (cached) return cached;
  const path = join(process.cwd(), '.translations', `${locale}.json`);
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as Catalog;
  cache.set(locale, parsed);
  return parsed;
}
```

## Wire the provider

```tsx
// app/root.tsx
import { TranslationProvider } from '@autotranslate/react';
import { Outlet, useLoaderData } from 'react-router';
import { loadCatalog } from './utils/catalog.server';
import { resolveLocale } from './utils/locale.server';

export async function loader({ request }: { request: Request }) {
  const locale = resolveLocale(request);
  const [catalog, fallback] = await Promise.all([
    loadCatalog(locale),
    locale === 'en' ? Promise.resolve(undefined) : loadCatalog('en'),
  ]);
  return { locale, catalog, fallback };
}

export default function Root() {
  const { locale, catalog, fallback } = useLoaderData<typeof loader>();
  return (
    <html lang={locale}>
      <body>
        <TranslationProvider
          locale={locale}
          catalog={catalog}
          fallback={fallback}
        >
          <Outlet />
        </TranslationProvider>
      </body>
    </html>
  );
}
```

## Server-side translation in loaders

```ts
import { getT } from '@autotranslate/react/server';

export async function loader({ request }: { request: Request }) {
  const locale = resolveLocale(request);
  const t = await getT(locale, loadCatalog);
  return { greeting: t.t('Welcome, {name}!', { name: 'Ada' }) };
}
```

## Translated Zod errors in actions

`@autotranslate/zod/remix` ships an adapter that scopes a translator to the
request:

```ts
// app/routes/sign-up.tsx
import { zodErrorMap } from '@autotranslate/zod';
import { withRequestTranslator } from '@autotranslate/zod/remix';
import * as z from 'zod';
import { loadCatalog } from '../utils/catalog.server';
import { SUPPORTED_LOCALES } from '../utils/locale.server';

z.config({ customError: zodErrorMap });

const userSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function action({ request }: { request: Request }) {
  return withRequestTranslator(
    request,
    {
      availableLocales: SUPPORTED_LOCALES,
      defaultLocale: 'en',
      loadCatalog,
    },
    async () => {
      const data = userSchema.parse(
        Object.fromEntries(await request.formData()),
      );
      // …
    },
  );
}
```

The error map sees the translator scoped to the request locale, so validation
errors come back in the right language. See
[Zod integration](../integrations/zod.md).

## Setting the locale via cookie

```ts
// app/routes/api.set-locale.tsx
export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const locale = String(form.get('locale'));
  return new Response(null, {
    status: 303,
    headers: {
      'set-cookie': `locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`,
      Location: form.get('redirect')?.toString() ?? '/',
    },
  });
}
```

```tsx
// app/components/LocaleSwitcher.tsx
import { useLocale } from '@autotranslate/react';
import { Form } from 'react-router';

export function LocaleSwitcher() {
  const active = useLocale();
  return (
    <Form method="post" action="/api/set-locale">
      <select
        name="locale"
        defaultValue={active}
        onChange={(e) => e.currentTarget.form?.submit()}
      >
        {/* … */}
      </select>
    </Form>
  );
}
```

## Tips

- **Memoise the catalog loader** in module scope. Loaders run on every request.

- **Don't import `.translations/*.json` directly into client modules.** Vite +
  Remix bundle them on the server; the client loads them via `useLoaderData`
  through the root loader.

- **Use the standalone `t()`** for any non-React translation in loaders /
  actions: scoped via `withRequestTranslator` keeps concurrent requests
  isolated. See [Standalone `t()`](../guides/standalone-t.md).
