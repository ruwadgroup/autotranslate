# Server Actions / route handlers

The standalone `t()` is the right tool for non-React server code: validators,
emails, queue payloads, audit logs, error responses.

## Pattern

```ts
'use server';

import { withTranslator } from '@autotranslate/core/standalone';
import { getT, getRequestLocale } from '@autotranslate/next';
import { t } from '@autotranslate/core/t';

export async function signUp(formData: FormData) {
  const locale = (await getRequestLocale()) ?? 'en';
  const translator = await getT(locale);

  return withTranslator(translator, async () => {
    // Anywhere here, t('…') sees `locale`
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

`withTranslator` is async-safe — `await`s inside the body still see the binding.

## Sugar: `withRequestTranslator` (Next)

The pattern above is the default Server Action shape, so `@autotranslate/zod`
ships sugar:

```ts
'use server';

import { withRequestTranslator } from '@autotranslate/zod/next';
import { t } from '@autotranslate/core/t';

export async function signUp(formData: FormData) {
  return withRequestTranslator(async () => {
    const data = userSchema.parse(Object.fromEntries(formData));
    await sendEmail({
      to: data.email,
      subject: t('Welcome!'),
    });
    return { ok: true };
  });
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

export async function POST(request: Request) {
  return withRequestTranslator(async () => {
    const body = await request.json();
    const data = userSchema.parse(body);
    return Response.json({ message: t('Created') });
  });
}
```

## Edge runtime

`fsCatalogLoader` (the default) uses `node:fs/promises` and won't run on the
edge. Override the loader with bundled JSON or KV-backed reads:

```ts
import { withTranslator } from '@autotranslate/core/standalone';
import { getT } from '@autotranslate/next';
import en from '@/catalogs/en.json' with { type: 'json' };
import fr from '@/catalogs/fr.json' with { type: 'json' };

export const runtime = 'edge';

const catalogs = { en, fr } as const;

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get('locale') ?? 'en';
  const t = await getT(locale, {
    load: (l) => catalogs[l as keyof typeof catalogs] ?? {},
  });
  return withTranslator(t, () => Response.json({ greeting: t.t('Welcome') }));
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
      // …
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
    // build + send the email …
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
