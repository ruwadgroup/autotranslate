# Remix / React Router 7+

Remix has no dedicated autotranslate adapter package. You wire
`@autotranslate/react` and the standalone `t()` directly, then drive the dev
loop separately. If you are using Remix with Vite (the default since Remix
v2.8), the `@autotranslate/vite` plugin handles the dev loop and HMR
automatically.

## Install

```bash
pnpm add @autotranslate/react @autotranslate/core
pnpm add -D @autotranslate/cli
```

For Remix + Vite (recommended):

```bash
pnpm add -D @autotranslate/vite
```

For translated Zod errors:

```bash
pnpm add @autotranslate/zod
```

Run `npx autotranslate init` to generate `autotranslate.config.ts` and
`.translations/`.

## Dev loop

### Remix + Vite

Add the plugin to your Vite config and the dev loop starts automatically:

```ts
// vite.config.ts
import { vitePlugin as remix } from '@remix-run/dev';
import autotranslate from '@autotranslate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [remix(), autotranslate()],
});
```

On save, the plugin runs extract -> translate -> generate-types and triggers
HMR. See the [Vite guide](./vite.md) for full options.

### Remix without Vite

Start the dev loop from a small script alongside your dev server:

```ts
// scripts/i18n-dev.ts
import { createDevLoop } from '@autotranslate/cli';

const handle = createDevLoop({
  cwd: process.cwd(),
  onEvent: (e) => {
    if (e.type === 'run-complete')
      console.log('[i18n] translated:', e.translated);
    if (e.type === 'error') console.warn('[i18n]', e.error);
  },
});

process.on('SIGINT', () => handle.close().then(() => process.exit()));
```

Run it in a separate terminal: `tsx scripts/i18n-dev.ts`. Or add it as a
`dev:i18n` script and use `concurrently` to run it alongside your Remix dev
server.

## Resolve the locale

A typical Remix root pulls from the URL path, cookie, or `Accept-Language`:

```ts
// app/utils/locale.server.ts
import { matchLocale } from '@autotranslate/core/locale';

export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'ja'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function resolveLocale(request: Request): SupportedLocale {
  const cookie = request.headers.get('cookie') ?? undefined;
  const accept = request.headers.get('accept-language') ?? undefined;
  const matched = matchLocale({
    path: new URL(request.url).pathname,
    accept,
    cookie,
    defaultLocale: 'en',
    supported: SUPPORTED_LOCALES,
  });
  return matched as SupportedLocale;
}
```

`matchLocale` checks path -> cookie -> `Accept-Language` -> default in that
order.

## Load the catalog

Import the generated catalog module. It uses static `import()` specifiers so
Vite code-splits per locale:

```ts
// app/utils/catalog.server.ts
import * as catalogModule from '../../.translations';

export { catalogModule };
```

For server-side rendering without Vite (e.g. pure Node), you can import the
module directly from the filesystem since Node resolves TypeScript-generated
modules. The module's `loadCatalog(locale)` method returns a Promise that
resolves to the merged catalog for that locale.

## Wire the provider

```tsx
// app/root.tsx
import { TranslationProvider } from '@autotranslate/react';
import { Outlet, useLoaderData } from 'react-router';
import { catalogModule } from './utils/catalog.server';
import { resolveLocale } from './utils/locale.server';

export async function loader({ request }: { request: Request }) {
  const locale = resolveLocale(request);
  const [catalog, fallback] = await Promise.all([
    catalogModule.loadCatalog(locale),
    locale === 'en' ? Promise.resolve({}) : catalogModule.loadCatalog('en'),
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
import { catalogModule } from '../utils/catalog.server';

export async function loader({ request }: { request: Request }) {
  const locale = resolveLocale(request);
  const t = await getT(locale, catalogModule.loadCatalog);
  return { greeting: t.t('Welcome, {name}!', { name: 'Ada' }) };
}
```

`getT(locale, loadCatalog, loadFallback?)` from `@autotranslate/react/server`
returns a `Translator` bound to `locale`. Pass `catalogModule.loadCatalog`
directly - it has the right signature `(locale: Locale) => Promise<Catalog>`.

## Translated Zod errors in actions

`@autotranslate/zod/remix` ships an adapter that scopes a translator to the
request locale:

```ts
// app/routes/sign-up.tsx
import { zodErrorMap } from '@autotranslate/zod';
import { withRequestTranslator } from '@autotranslate/zod/remix';
import * as z from 'zod';
import { catalogModule } from '../utils/catalog.server';
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
      loadCatalog: catalogModule.loadCatalog,
    },
    async () => {
      const data = userSchema.parse(
        Object.fromEntries(await request.formData()),
      );
      // ...
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
        {/* ... */}
      </select>
    </Form>
  );
}
```

## Tips

- **The catalog module handles code-splitting.** Do not read
  `.translations/{locale}/*.json` files directly - use
  `catalogModule.loadCatalog(locale)` so Vite can split per locale.
- **Memoize nothing extra.** The catalog module already memos per (module,
  locale) internally via a WeakMap; double-caching wastes memory.
- **Use the standalone `t()`** for any non-React translation in loaders or
  actions. Scope it with `withRequestTranslator` to keep concurrent requests
  isolated. See [Standalone `t()`](../guides/standalone-t.md).
- **CI pipeline** - run `autotranslate extract && autotranslate translate` on
  every PR. The build automatically verifies the catalog is up to date when
  `build.frozen` is `true` (the default).
