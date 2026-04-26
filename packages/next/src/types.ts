import type { Catalog, Locale } from '@autotranslate/core';

export type CatalogLoader = (locale: Locale) => Promise<Catalog> | Catalog;

export interface NextLocaleConfig {
  /** Default locale used when nothing else matches. */
  readonly defaultLocale: Locale;
  /** All supported locales (must include `defaultLocale`). */
  readonly locales: ReadonlyArray<Locale>;
}

export interface ProxyOptions extends NextLocaleConfig {
  /**
   * How locale is encoded in the URL.
   *
   * - `'prefix'` — `/<locale>/...` paths; the proxy redirects bare paths to
   *   the matched locale.
   * - `'cookie'` — locale lives in a cookie; the proxy doesn't change paths.
   */
  readonly strategy?: 'prefix' | 'cookie';
  /** Cookie name used by the `'cookie'` strategy. Default `'NEXT_LOCALE'`. */
  readonly cookieName?: string;
  /**
   * For the `'prefix'` strategy: whether to keep the default locale visible
   * in the URL. When `false` (the default), the default-locale prefix is
   * stripped on redirect.
   */
  readonly prefixDefaultLocale?: boolean;
}

export interface GetTOptions {
  /** Source-locale fallback. Used when `locale` is missing a key. */
  readonly fallback?: Locale;
  /** Override the default fs-backed catalog loader. */
  readonly load?: CatalogLoader;
  /** Override the default `.translations` directory (relative to `cwd`). */
  readonly outDir?: string;
  /** Defaults to `process.cwd()`. Useful for tests. */
  readonly cwd?: string;
}

/** HTTP header set by `createNextMiddleware` and read by `getRequestLocale`. */
export const LOCALE_HEADER = 'x-autotranslate-locale';
