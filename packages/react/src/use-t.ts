import { createTranslator } from '@autotranslate/core';
import { useCallback, useMemo } from 'react';
import { useTranslationContext } from './context';

/**
 * Open interface augmented by `autotranslate generate-types` to expose the
 * known catalog keys to TypeScript. Empty by design — augmentation requires
 * an `interface`.
 */
// biome-ignore lint/suspicious/noEmptyInterface: open for module augmentation
export interface AutotranslateCatalog {}

/**
 * Union of generated catalog keys when typegen has run, or `string` otherwise.
 * The `(string & {})` arm preserves autocomplete while still accepting any string.
 */
export type CatalogKey = keyof AutotranslateCatalog extends never
  ? string
  : keyof AutotranslateCatalog | (string & {});

/**
 * Hook returning a translator function bound to the active locale + catalog.
 *
 * ```tsx
 * const t = useT();
 * t('Sign out');
 * t('Hello, {name}!', { name });
 * t('Submit', { $context: 'form button' });
 * ```
 */
export function useT(): (key: CatalogKey, params?: Readonly<Record<string, unknown>>) => string {
  const { locale, catalog, fallback } = useTranslationContext();
  const translator = useMemo(
    () => createTranslator({ locale, catalog, ...(fallback ? { fallback } : {}) }),
    [locale, catalog, fallback],
  );
  return useCallback((key: CatalogKey, params) => translator.t(key, params), [translator]);
}

/**
 * Dictionary-mode hook. Prefixes every lookup with `namespace.` so nested keys
 * read naturally.
 *
 * ```ts
 * const t = useTranslations('dashboard');
 * t('title'); // → "Dashboard"
 * ```
 */
export function useTranslations(
  namespace?: string,
): (key: CatalogKey, params?: Readonly<Record<string, unknown>>) => string {
  const t = useT();
  const prefix = namespace ? `${namespace}.` : '';
  return useCallback((key: CatalogKey, params) => t(`${prefix}${key}`, params), [t, prefix]);
}

export function useLocale(): string {
  return useTranslationContext().locale;
}
