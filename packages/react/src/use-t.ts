import { type CatalogKey as CoreCatalogKey, createTranslator } from '@autotranslate/core';
import { useCallback, useMemo } from 'react';
import { useTranslationContext } from './context';

/** Back-compat augmentation point. Canonical interface lives in `@autotranslate/core`. */
// biome-ignore lint/suspicious/noEmptyInterface: back-compat augmentation point
export interface AutotranslateCatalog {}

type LegacyKey = keyof AutotranslateCatalog;

/** Generated catalog keys (from core or this package's legacy interface), or `string`. */
export type CatalogKey = [LegacyKey] extends [never] ? CoreCatalogKey : LegacyKey | CoreCatalogKey;

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
