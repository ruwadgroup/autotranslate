import type { Catalog, Locale } from '@autotranslate/core';
import { createContext, useContext } from 'react';

export interface TranslationContextValue {
  readonly locale: Locale;
  readonly catalog: Catalog;
  readonly fallback?: Catalog;
}

const DEFAULT_VALUE: TranslationContextValue = { locale: 'en', catalog: {} };

export const TranslationContext = createContext<TranslationContextValue>(DEFAULT_VALUE);

export function useTranslationContext(): TranslationContextValue {
  return useContext(TranslationContext);
}
