# Server Actions / route handlers

The standalone `t()` is the right tool for non-React server code: validators,
emails, queue payloads, audit logs, and error responses.

## Pattern

```ts
'use server';

import { withTranslator } from '@autotranslate/core/standalone';
import { getT, getRequestLocale } from '@autotranslate/next';
import { t } from '@autotranslate/core/t';
import * as catalogModule from '../../.translations';

export async function signUp(formData: FormData) {
  const locale = (await getRequestLocale()) ?? 'en';
  const translator = await getT(locale, { module: catalogModule });

  return withTranslator(translator, async () => {
    // Anywhere here, t('...') sees `locale`
    const data = userSchema.parse(Object.fromEntries(formData));
    await sendEmail({
      to: data.email,
      subject: t('Welcome, {name}!', { name: data.name }),
      body: t('Thanks for signing up. Click the link to verify your email.'),
    });
    return { ok: true };
  });
}
```

`withTranslator` is async-safe - `await`s inside the body still see the binding.

## Sugar: `withRequestTranslator` (Next)

The pattern above is the default Server Action shape, so
`@autotranslate/zod/next` ships sugar:

```ts
'use server';

import { withRequestTranslator } from '@autotranslate/zod/next';
import { t } from '@autotranslate/core/t';
import * as catalogModule from '../../.translations';

export async function signUp(formData: FormData) {
  return withRequestTranslator(
    async () => {
      const data = userSchema.parse(Object.fromEntries(formData));
      await sendEmail({
        to: data.email,
        subject: t('Welcome!'),
      });
      return { ok: true };
    },
    { module: catalogModule },
  );
}
```

`withRequestTranslator` reads the request locale from the proxy, builds a
translator with the bundled English `fallback`, and runs the body inside
`withTranslator`.

## Route handlers (App Router)

```ts
// app/api/users/route.ts
import { withRequestTranslator } from '@autotranslate/zod/next';
import { t } from '@autotranslate/core/t';
import * as catalogModule from '../../.translations';

export async function POST(request: Request) {
  return withRequestTranslator(
    async () => {
      const body = await request.json();
      const data = userSchema.parse(body);
      return Response.json({ message: t('Created') });
    },
    { module: catalogModule },
  );
}
```

## Edge runtime

The generated catalog module
(`import * as catalogModule from '../../.translations'`) works on edge runtimes
without any extra configuration. Bundlers (Turbopack, Webpack, Vite) resolve the
static `import()` specifiers inside `loadCatalog` at build time, so no
filesystem access happens at runtime.

```ts
'use server';

import { withRequestTranslator } from '@autotranslate/zod/next';
import { t } from '@autotranslate/core/t';
import * as catalogModule from '../../.translations';

export const runtime = 'edge';

export async function POST(request: Request) {
  return withRequestTranslator(
    async () => {
      const body = await request.json();
      return Response.json({ message: t('Created') });
    },
    { module: catalogModule },
  );
}
```

For truly custom sources (Vercel KV, Edge Config, Workers KV) where you want to
bypass the generated module entirely, use the `load` callback instead:

```ts
import { getT } from '@autotranslate/next';
import { get } from '@vercel/edge-config';
import type { Catalog } from '@autotranslate/core';

export const runtime = 'edge';

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get('locale') ?? 'en';
  const t = await getT(locale, {
    async load(l) {
      const blob = await get<Catalog>(`autotranslate:${l}`);
      return blob ?? {};
    },
  });
  return Response.json({ greeting: t.t('Welcome') });
}
```

## Remix actions

`@autotranslate/zod/remix` ships an adapter:

```ts
import { withRequestTranslator } from '@autotranslate/zod/remix';
import { loadCatalog, SUPPORTED_LOCALES } from '../utils/locale.server';

export async function action({ request }: { request: Request }) {
  return withRequestTranslator(
    request,
    {
      availableLocales: SUPPORTED_LOCALES,
      defaultLocale: 'en',
      loadCatalog,
    },
    async () => {
      // ...
    },
  );
}
```

## Background jobs

Same `withTranslator` pattern. Pass the locale through the job payload:

```ts
import { withTranslator } from '@autotranslate/core/standalone';
import { createTranslator } from '@autotranslate/core';
import { loadCatalog } from './catalogs';

export async function processWelcomeEmailJob(job: {
  userId: string;
  locale: string;
}) {
  const translator = createTranslator({
    locale: job.locale,
    catalog: await loadCatalog(job.locale),
    fallback: await loadCatalog('en'),
  });
  await withTranslator(translator, async () => {
    // build + send the email ...
  });
}
```

## Tips

- **Always pair `withTranslator` with the request locale.** Process-wide binding
  (`bindTranslator`) leaks across concurrent requests and is wrong for SSR.

- **Localise emails / push notifications.** They're typed as i18n surfaces but
  most apps default to a hardcoded language. Read the recipient's preferred
  locale from the user record, not the requesting user.

- **Translated error responses.** Wrap your error handler in
  `withRequestTranslator` so 4xx/5xx bodies come back in the user's language.
