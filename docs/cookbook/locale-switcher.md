# Locale switcher

A dropdown that swaps the active locale, plus three patterns for persisting the
choice across reloads.

## SPA — state-only switch

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
      {/* … */}
    </TranslationProvider>
  );
}
```

## Persist via cookie (Next App Router)

The proxy from `@autotranslate/next/middleware` already prefers cookies over
`Accept-Language` when `strategy: 'cookie'`.

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
      {/* … */}
    </select>
  );
}
```

## Persist via path prefix (Next App Router)

When using the default proxy strategy (`prefix`), changing locale is a
navigation:

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

The proxy handles default-locale stripping; your switcher can stay agnostic.

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

`nameOf(c, c)` renders each locale's name _in its own language_. Pass `active`
to render every option in the active locale instead.

## Tips

- **Cookie names matter.** If you use `next-intl` or anything else with
  `NEXT_LOCALE`, pick a different cookie or accept the conflict.
- **RTL.** Set `<html dir>` based on the locale. `getDirection(locale)` from
  `@autotranslate/core/locale` returns `'rtl'` for `ar`, `he`, `fa`, `ur`.
- **Persisted choice beats `Accept-Language`.** Always — the user's explicit
  click should win over header-based detection.
