/// <reference types="vite/client" />

declare module 'virtual:autotranslate' {
  import type { Catalog, Locale } from '@autotranslate/core';

  /** Map of locale tag → catalog, populated at build time from `.translations/`. */
  export const catalogs: Readonly<Record<Locale, Catalog>>;

  /** Source locale resolved from `autotranslate.config.ts`. */
  export const source: Locale;

  /** All locales the plugin loaded — usually `[source, ...targets]`. */
  export const locales: ReadonlyArray<Locale>;
}
