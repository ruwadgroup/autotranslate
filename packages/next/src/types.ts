import type { Catalog, Locale } from '@autotranslate/core';

export type CatalogLoader = (locale: Locale) => Promise<Catalog> | Catalog;

export interface NextLocaleConfig {
  readonly defaultLocale: Locale;
  /** Must include `defaultLocale`. */
  readonly locales: ReadonlyArray<Locale>;
}

export interface ProxyOptions extends NextLocaleConfig {
  /**
   * - `'prefix'` — `/<locale>/...` paths, redirects bare paths to the match.
   * - `'cookie'` — locale lives in a cookie; paths unchanged.
   */
  readonly strategy?: 'prefix' | 'cookie';
  readonly cookieName?: string;
  /** Keep the default-locale prefix in the URL. Default `false`. */
  readonly prefixDefaultLocale?: boolean;
}

export interface GetTOptions {
  /** Source-locale fallback used when `locale` is missing a key. */
  readonly fallback?: Locale;
  readonly load?: CatalogLoader;
  /** Defaults to `.translations`, relative to `cwd`. */
  readonly outDir?: string;
  /** Defaults to `process.cwd()`. */
  readonly cwd?: string;
}

export const LOCALE_HEADER = 'x-autotranslate-locale';
