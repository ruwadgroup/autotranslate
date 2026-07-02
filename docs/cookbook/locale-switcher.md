# Locale switcher

Build a dropdown that lets users switch the active locale and persist their
choice across page loads. Three patterns below - pick the one that matches your
routing strategy.

## SPA - state-only switch

For a client-rendered app with no URL-based routing, hold the locale in state
and pass it to `TranslationProvider`:

```tsx
import { TranslationProvider, useLocale } from '@autotranslate/react';
import { useState } from 'react';

const SUPPORTED = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ja', label: '日本語' },
] as const;

function LocaleSwitcher({ onChange }: { onChange: (locale: string) => void }) {
  const active = useLocale();
  return (
    <select value={active} onChange={(e) => onChange(e.target.value)}>
      {SUPPORTED.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

export function App({ catalogs }: { catalogs: Record<string, Catalog> }) {
  const [locale, setLocale] = useState('en');
  return (
    <TranslationProvider
      locale={locale}
      catalog={catalogs[locale]}
      fallback={catalogs.en}
    >
      <LocaleSwitcher onChange={setLocale} />
      {/* ... */}
    </TranslationProvider>
  );
}
```

## Persist via cookie (Next App Router)

The middleware from `@autotranslate/next/middleware` already prefers cookies
over `Accept-Language` when `strategy: 'cookie'` is set. Write the locale cookie
from an API route, then refresh the page:

```ts
// app/api/set-locale/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { locale } = (await request.json()) as { locale: string };
  const res = NextResponse.json({ ok: true });
  res.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  return res;
}
```

```tsx
// app/components/LocaleSwitcher.tsx
'use client';

import { useLocale } from '@autotranslate/react';
import { useRouter } from 'next/navigation';

export function LocaleSwitcher() {
  const active = useLocale();
  const router = useRouter();

  async function onChange(locale: string) {
    await fetch('/api/set-locale', {
      method: 'POST',
      body: JSON.stringify({ locale }),
    });
    router.refresh();
  }

  return (
    <select value={active} onChange={(e) => onChange(e.target.value)}>
      {/* ... */}
    </select>
  );
}
```

## Persist via path prefix (Next App Router)

When using the default middleware strategy (`prefix`), switching locale is a
navigation to a new path. Strip the current locale prefix and push the new one:

```tsx
'use client';

import { useLocale } from '@autotranslate/react';
import { usePathname, useRouter } from 'next/navigation';

const SUPPORTED = ['en', 'es', 'fr', 'ja'] as const;

export function LocaleSwitcher() {
  const active = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function onChange(locale: string) {
    const stripped =
      pathname.replace(new RegExp(`^/(${SUPPORTED.join('|')})`), '') || '/';
    router.push(`/${locale}${stripped}`);
  }

  return (
    <select value={active} onChange={(e) => onChange(e.target.value)}>
      {SUPPORTED.map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  );
}
```

The middleware handles default-locale stripping, so your switcher can stay
agnostic.

## Localised labels

Render each locale's name in its own language:

```ts
// src/locales.ts
export const SUPPORTED = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ja', label: '日本語' },
  { code: 'ar', label: 'العربية' },
] as const;
```

Or pull from `Intl.DisplayNames`:

```ts
import { useLocale } from '@autotranslate/react';

function nameOf(code: string, displayLocale: string) {
  return new Intl.DisplayNames([displayLocale], { type: 'language' }).of(code) ?? code;
}

function LocaleSwitcher({ codes }: { codes: ReadonlyArray<string> }) {
  const active = useLocale();
  return (
    <select value={active}>
      {codes.map((c) => (
        <option key={c} value={c}>{nameOf(c, c)}</option>
      ))}
    </select>
  );
}
```

`nameOf(c, c)` renders each locale's name in its own language. Pass `active`
instead of `c` to render every option in the currently active locale.

## Tips

- **Cookie names matter.** If you use `next-intl` or anything else with
  `NEXT_LOCALE`, pick a different cookie name or accept the conflict.
- **RTL.** Set `<html dir>` based on the locale. `getDirection(locale)` from
  `@autotranslate/core/locale` returns `'rtl'` for `ar`, `he`, `fa`, and `ur`.
- **Persisted choice beats `Accept-Language`.** The user's explicit click should
  always win over header-based detection.
