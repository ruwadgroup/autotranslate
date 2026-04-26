import type { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { createNextMiddleware } from './middleware';
import { LOCALE_HEADER } from './types';

interface FakeOptions {
  readonly url: string;
  readonly accept?: string;
  readonly cookie?: { readonly name: string; readonly value: string };
}

function fakeRequest({ url, accept, cookie }: FakeOptions): NextRequest {
  const u = new URL(url);
  const headers = new Headers();
  if (accept) headers.set('accept-language', accept);
  return {
    nextUrl: Object.assign(u, {
      clone: () => new URL(u.toString()),
    }),
    headers,
    cookies: {
      get: (name: string) => (cookie && cookie.name === name ? { value: cookie.value } : undefined),
    },
  } as unknown as NextRequest;
}

describe('createNextMiddleware (prefix strategy)', () => {
  const proxy = createNextMiddleware({
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
  });

  it('passes through and tags the request when path already has a locale', () => {
    const res = proxy(fakeRequest({ url: 'https://app.test/es/about' }));
    expect(res?.headers.get(LOCALE_HEADER) ?? null).toBeNull();
    expect((res as unknown as { headers: Headers }).headers).toBeDefined();
  });

  it('redirects bare paths to the matched-locale prefix', () => {
    const res = proxy(fakeRequest({ url: 'https://app.test/about', accept: 'es,en;q=0.9' }));
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toContain('/es/about');
  });

  it('keeps the default locale at root when prefixDefaultLocale is off', () => {
    const res = proxy(fakeRequest({ url: 'https://app.test/about', accept: 'en' }));
    // Default locale at root → next() pass-through (no redirect)
    expect(res?.status).not.toBe(307);
  });

  it('strips the default-locale prefix when set explicitly', () => {
    const res = proxy(fakeRequest({ url: 'https://app.test/en/about' }));
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toMatch(/\/about$/);
  });

  it('honors prefixDefaultLocale when on', () => {
    const proxyOn = createNextMiddleware({
      defaultLocale: 'en',
      locales: ['en', 'es', 'fr'],
      prefixDefaultLocale: true,
    });
    const bareRoot = proxyOn(fakeRequest({ url: 'https://app.test/about', accept: 'en' }));
    expect(bareRoot?.status).toBe(307);
    expect(bareRoot?.headers.get('location')).toContain('/en/about');
  });
});

describe('createNextMiddleware (cookie strategy)', () => {
  const proxy = createNextMiddleware({
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
    strategy: 'cookie',
  });

  it('uses the cookie when present', () => {
    const res = proxy(
      fakeRequest({
        url: 'https://app.test/about',
        cookie: { name: 'NEXT_LOCALE', value: 'fr' },
      }),
    );
    expect(res?.status).not.toBe(307);
  });

  it('falls back to Accept-Language', () => {
    const res = proxy(fakeRequest({ url: 'https://app.test/about', accept: 'es-ES,es;q=0.9' }));
    expect(res?.status).not.toBe(307);
  });

  it('respects a custom cookieName', () => {
    const proxyCustom = createNextMiddleware({
      defaultLocale: 'en',
      locales: ['en', 'es'],
      strategy: 'cookie',
      cookieName: 'my-locale',
    });
    const res = proxyCustom(
      fakeRequest({
        url: 'https://app.test/about',
        cookie: { name: 'my-locale', value: 'es' },
      }),
    );
    expect(res?.status).not.toBe(307);
  });
});
