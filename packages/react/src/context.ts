import type { Catalog, Locale } from '@autotranslate/core';
import { createContext, useContext } from 'react';

export interface TranslationContextValue {
  readonly locale: Locale;
  readonly catalog: Catalog;
  readonly fallback?: Catalog;
}

const DEFAULT_VALUE: TranslationContextValue = { locale: 'en', catalog: {} };

export const TranslationContext = createContext<TranslationContextValue>(DEFAULT_VALUE);

/**
 * Read the active translation context. Returns a sane default
 * (`{ locale: 'en', catalog: {} }`) when no provider is mounted, so calls
 * outside a provider degrade to source rendering instead of throwing.
 */
export function useTranslationContext(): TranslationContextValue {
  return useContext(TranslationContext);
}
