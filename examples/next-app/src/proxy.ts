import { createNextMiddleware } from '@autotranslate/next/middleware';

// Next 16 renamed `middleware` → `proxy`. Same idea: runs before route
// handlers, redirects bare paths to /<locale>/..., tags downstream
// requests with the resolved locale via the x-autotranslate-locale header.
export default createNextMiddleware({
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr', 'ja'],
  // Every page lives under `app/[lang]/` — there's no bare `app/page.tsx`.
  // Force the prefix so `/` redirects to `/en` instead of 404'ing.
  prefixDefaultLocale: true,
});

export const config = {
  matcher: [
    // Skip Next internals, the public folder, and any path that looks like a
    // file (anything with a dot in the last segment).
    '/((?!api|_next|.*\\..*).*)',
  ],
};
