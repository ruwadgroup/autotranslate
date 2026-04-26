'use client';

/**
 * React adapter for autotranslate.
 *
 * `<T>` for translatable JSX trees, `<Var>` / `<Plural>` for slots,
 * `<TranslationProvider>` for locale + catalog context, `useT` / `useLocale`
 * for plain-string translation and locale read-out.
 *
 * The `'use client'` directive at the top tells RSC bundlers (Next.js App
 * Router) to treat this entry as a client module, since every export here
 * touches React hooks or context. Server-only helpers live on the `/server`
 * subpath, which is selected automatically by the `react-server` export
 * condition in `package.json`.
 */

export const VERSION = '0.0.0';

export type { TranslationContextValue } from './context';
export { TranslationContext, useTranslationContext } from './context';
export type { PluralProps, VarProps } from './markers';
export { Plural, Var } from './markers';
export type { TranslationProviderProps } from './provider';
export { TranslationProvider } from './provider';
export type { TProps } from './T';
export { T } from './T';
export { useLocale, useT } from './use-t';
