import type { Catalog, Locale } from '@autotranslate/core';
import { type ReactElement, type ReactNode, useMemo } from 'react';
import { TranslationContext } from './context';

export interface TranslationProviderProps {
  readonly locale: Locale;
  readonly catalog?: Catalog;
  /** Source-locale catalog used as fallback when `catalog` misses a key. */
  readonly fallback?: Catalog;
  readonly children: ReactNode;
}

export function TranslationProvider({
  locale,
  catalog,
  fallback,
  children,
}: TranslationProviderProps): ReactElement {
  const value = useMemo(
    () => ({
      locale,
      catalog: catalog ?? {},
      ...(fallback ? { fallback } : {}),
    }),
    [locale, catalog, fallback],
  );
  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}
