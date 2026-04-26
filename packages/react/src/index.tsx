/**
 * React adapter for autotranslate.
 *
 * `<T>` for translatable JSX trees, `<Var>` / `<Plural>` for slots,
 * `<TranslationProvider>` for locale + catalog context, `useT` / `useLocale`
 * for plain-string translation and locale read-out.
 *
 * RSC / SSR helpers live on the `/server` subpath.
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
