import type { Locale } from '@autotranslate/core';
import { matchLocale } from '@autotranslate/core/locale';
import { type NextRequest, NextResponse } from 'next/server';
import { LOCALE_HEADER, type ProxyOptions } from './types';

const DEFAULT_COOKIE_NAME = 'NEXT_LOCALE';

/**
 * Build a Next 16 `proxy` function (formerly `middleware`) that resolves
 * the active locale from path → cookie → `Accept-Language`, then either
 * redirects bare paths under `/<locale>/...` (`strategy: 'prefix'`, default)
 * or just sets a cookie (`strategy: 'cookie'`).
 *
 * In both modes, the resolved locale is pushed downstream via the
 * `x-autotranslate-locale` request header so server components can read it
 * via `getRequestLocale()`.
 *
 * ```ts
 * // proxy.ts
 * import { createNextMiddleware } from '@autotranslate/next/middleware';
 *
 * export default createNextMiddleware({
 *   defaultLocale: 'en',
 *   locales: ['en', 'es', 'fr', 'ja'],
 * });
 *
 * export const config = {
 *   matcher: ['/((?!api|_next|.*\\..*).*)'],
 * };
 * ```
 */
export function createNextMiddleware(
  options: ProxyOptions,
): (request: NextRequest) => NextResponse | undefined {
  const {
    defaultLocale,
    locales,
    strategy = 'prefix',
    cookieName = DEFAULT_COOKIE_NAME,
    prefixDefaultLocale = false,
  } = options;

  return (request: NextRequest) => {
    const { pathname } = request.nextUrl;
    const cookie = request.cookies.get(cookieName)?.value;
    const accept = request.headers.get('accept-language') ?? undefined;

    if (strategy === 'cookie') {
      const matched = matchLocale({
        defaultLocale,
        supported: locales,
        ...(cookie ? { cookie } : {}),
        ...(accept ? { accept } : {}),
      });
      const headers = new Headers(request.headers);
      headers.set(LOCALE_HEADER, matched);
      return NextResponse.next({ request: { headers } });
    }

    // 'prefix' strategy
    const segments = pathname.split('/').filter(Boolean);
    const first = segments[0];
    const pathLocale =
      first && (locales as ReadonlyArray<string>).includes(first) ? (first as Locale) : undefined;

    if (pathLocale) {
      // Strip the default-locale prefix when `prefixDefaultLocale` is off,
      // so the canonical URL for the default locale stays at `/`.
      if (pathLocale === defaultLocale && !prefixDefaultLocale) {
        const url = request.nextUrl.clone();
        const stripped = `/${segments.slice(1).join('/')}`;
        url.pathname = stripped === '/' ? '/' : stripped.replace(/\/+$/, '');
        return NextResponse.redirect(url);
      }
      const headers = new Headers(request.headers);
      headers.set(LOCALE_HEADER, pathLocale);
      return NextResponse.next({ request: { headers } });
    }

    const matched = matchLocale({
      defaultLocale,
      supported: locales,
      path: pathname,
      ...(cookie ? { cookie } : {}),
      ...(accept ? { accept } : {}),
    });

    if (matched === defaultLocale && !prefixDefaultLocale) {
      const headers = new Headers(request.headers);
      headers.set(LOCALE_HEADER, matched);
      return NextResponse.next({ request: { headers } });
    }

    const url = request.nextUrl.clone();
    url.pathname = `/${matched}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  };
}

export { LOCALE_HEADER, type ProxyOptions } from './types';
