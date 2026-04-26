import { createTranslator } from '@autotranslate/core';
import { useCallback, useMemo } from 'react';
import { useTranslationContext } from './context';

/**
 * Hook returning a translator function bound to the active locale + catalog.
 *
 * ```tsx
 * const t = useT();
 * t('Sign out');                                  // string
 * t('Hello, {name}!', { name });                  // ICU vars
 * t('Submit', { $context: 'form button' });       // disambiguation hint
 * ```
 *
 * Use `<T>` for JSX-shaped messages with markup; `useT` is the right choice
 * for plain strings (button labels, attributes, aria, programmatic copy).
 *
 * Reserved option keys (consumed by the translator, not the ICU formatter):
 * `$context`, `$description`, `$maxChars`.
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
 * Dictionary-mode hook. Curries `useT` with a namespace prefix so callers
 * can lookup nested keys without repeating the prefix.
 *
 * ```ts
 * // dictionary.ts
 * export default { dashboard: { title: 'Dashboard' } };
 *
 * // component.tsx
 * const t = useTranslations('dashboard');
 * t('title'); // → "Dashboard"
 * ```
 *
 * `namespace` is concatenated to the key with a `.` separator. Pass an empty
 * string (or omit) to address keys at the dictionary root.
 */
export function useTranslations(
  namespace?: string,
): (key: string, params?: Readonly<Record<string, unknown>>) => string {
  const t = useT();
  const prefix = namespace ? `${namespace}.` : '';
  return useCallback((key, params) => t(`${prefix}${key}`, params), [t, prefix]);
}

/**
 * Hook returning the active locale. Re-renders when the provider changes it.
 */
export function useLocale(): string {
  return useTranslationContext().locale;
}
