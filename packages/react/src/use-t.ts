import type { CatalogKey } from '@autotranslate/core';
import { createTranslator } from '@autotranslate/core';
import { useCallback, useMemo } from 'react';
import { useTranslationContext } from './context';

export type { AutotranslateCatalog, CatalogKey } from '@autotranslate/core';

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
  const { locale, catalog, fallback, onMissing, source } = useTranslationContext();
  const translator = useMemo(
    () =>
      createTranslator({
        locale,
        catalog,
        ...(fallback ? { fallback } : {}),
        ...(onMissing ? { onMissing } : {}),
        ...(source ? { source } : {}),
      }),
    [locale, catalog, fallback, onMissing, source],
  );
  return useCallback((key: CatalogKey, params) => translator.t(key, params), [translator]);
}

export function useLocale(): string {
  return useTranslationContext().locale;
}
