import type { Catalog, Locale } from '@autotranslate/core';
import { type ReactElement, type ReactNode, useMemo } from 'react';
import { TranslationContext } from './context';

export interface TranslationProviderProps {
  /** Active locale. Children call `useT()` and `<T>` against this. */
  readonly locale: Locale;
  /** Translation catalog for `locale`. Defaults to empty (source pass-through). */
  readonly catalog?: Catalog;
  /**
   * Optional source-locale catalog used as fallback. When the active catalog
   * misses a key, the runtime tries `fallback` before falling back to source
   * children / the literal key.
   */
  readonly fallback?: Catalog;
  readonly children: ReactNode;
}

/**
 * Provides locale + catalog to descendants. Wrap your app once at the root.
 */
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
