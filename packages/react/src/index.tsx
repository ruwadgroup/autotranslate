'use client';

export type { AutotranslateCatalog, CatalogKey } from '@autotranslate/core';
export type { TranslationContextValue } from './context';
export { TranslationContext, useTranslationContext } from './context';
export type { DevOnMissingOptions } from './dev';
export { createDevOnMissing } from './dev';
export type {
  BranchProps,
  CurrencyProps,
  DateTimeProps,
  NumProps,
  PluralProps,
  RelativeTimeProps,
  VarProps,
} from './markers';
export { Branch, Currency, DateTime, Num, Plural, RelativeTime, Var } from './markers';
export type { TranslationProviderProps } from './provider';
export { TranslationProvider } from './provider';
export type { TProps } from './T';
export { T } from './T';
export { useLocale, useT, useTranslations } from './use-t';
