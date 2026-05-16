import type { Catalog, Locale } from '@autotranslate/core';
import { createContext, useContext } from 'react';

export interface TranslationContextValue {
  readonly locale: Locale;
  readonly catalog: Catalog;
  readonly fallback?: Catalog;
  /** Called when a key misses both `catalog` and `fallback`. Dev-only hooks live here. */
  readonly onMissing?: (key: string, locale: Locale) => string;
  /**
   * When `true`, `<T>` wraps its output in a `<span data-autotranslate="<hex12>">`
   * so the hash key can be inspected from devtools. Off by default.
   */
  readonly debugMarkers?: boolean;
}

const DEFAULT_VALUE: TranslationContextValue = { locale: 'en', catalog: {} };

export const TranslationContext = createContext<TranslationContextValue>(DEFAULT_VALUE);

export function useTranslationContext(): TranslationContextValue {
  return useContext(TranslationContext);
}
