import type { Catalog, Locale } from '@autotranslate/core';

export type CatalogLoader = (locale: Locale) => Promise<Catalog> | Catalog;

/**
 * The generated catalog module emitted by `autotranslate extract` at
 * `<outDir>/index.ts`. Import it statically so the bundler can code-split
 * catalogs per locale.
 */
export type CatalogModule = {
  source: Locale;
  locales: ReadonlyArray<Locale>;
  loadCatalog(locale: Locale): Promise<Catalog>;
};

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
  /**
   * Generated catalog module from `<outDir>/index.ts`.
   * Exactly one of `module` or `load` is required.
   */
  readonly module?: CatalogModule;
  /**
   * Custom catalog loader — use this for KV, Edge Config, or any non-bundled
   * source. Exactly one of `module` or `load` is required.
   */
  readonly load?: CatalogLoader;
}

export const LOCALE_HEADER = 'x-autotranslate-locale';
