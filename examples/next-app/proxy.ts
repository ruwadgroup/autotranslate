import { createNextMiddleware } from '@autotranslate/next/middleware';

// Next 16 renamed `middleware` → `proxy`. Same idea: runs before route
// handlers, redirects bare paths to /<locale>/..., tags downstream
// requests with the resolved locale via the x-autotranslate-locale header.
export default createNextMiddleware({
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr', 'ja'],
});

export const config = {
  matcher: [
    // Skip Next internals, the public folder, and any path that looks like a
    // file (anything with a dot in the last segment).
    '/((?!api|_next|.*\\..*).*)',
  ],
};
