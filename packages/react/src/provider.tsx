import type { Catalog, Locale } from '@autotranslate/core';
import { type ReactElement, type ReactNode, useMemo } from 'react';
import { TranslationContext } from './context';

export interface TranslationProviderProps {
  readonly locale: Locale;
  readonly catalog?: Catalog;
  /** Source-locale catalog used as fallback when `catalog` misses a key. */
  readonly fallback?: Catalog;
  /** Called when a key misses both `catalog` and `fallback`. Dev-only hooks live here. */
  readonly onMissing?: (key: string, locale: Locale) => string;
  readonly children: ReactNode;
}

export function TranslationProvider({
  locale,
  catalog,
  fallback,
  onMissing,
  children,
}: TranslationProviderProps): ReactElement {
  const value = useMemo(
    () => ({
      locale,
      catalog: catalog ?? {},
      ...(fallback ? { fallback } : {}),
      ...(onMissing ? { onMissing } : {}),
    }),
    [locale, catalog, fallback, onMissing],
  );
  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}
