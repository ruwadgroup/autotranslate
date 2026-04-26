import { createTranslator } from '@autotranslate/core';
import { useCallback, useMemo } from 'react';
import { useTranslationContext } from './context';

/**
 * Hook returning a translator function bound to the active locale + catalog.
 *
 * ```tsx
 * const t = useT();
 * t('Sign out');                 // string
 * t('Hello, {name}!', { name }); // string
 * ```
 *
 * Use `<T>` for JSX-shaped messages with markup; `useT` is the right choice
 * for plain strings (button labels, attributes, aria, programmatic copy).
 */
export function useT(): (key: string, params?: Readonly<Record<string, unknown>>) => string {
  const { locale, catalog, fallback } = useTranslationContext();
  const translator = useMemo(
    () => createTranslator({ locale, catalog, ...(fallback ? { fallback } : {}) }),
    [locale, catalog, fallback],
  );
  return useCallback((key, params) => translator.t(key, params), [translator]);
}

/**
 * Hook returning the active locale. Re-renders when the provider changes it.
 */
export function useLocale(): string {
  return useTranslationContext().locale;
}
