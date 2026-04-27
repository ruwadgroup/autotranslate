import {
  type Catalog,
  createTranslator as createCoreTranslator,
  type Locale,
  type Translator,
  type TranslatorOptions,
} from '@autotranslate/core';

/**
 * Server-only translator factory for RSC / SSR / route handlers.
 *
 * ```ts
 * import { getT } from '@autotranslate/react/server';
 *
 * export default async function Page() {
 *   const t = await getT('es', () => loadCatalog('es'));
 *   return <h1>{t('Welcome')}</h1>;
 * }
 * ```
 */
export async function getT(
  locale: Locale,
  loadCatalog: (locale: Locale) => Promise<Catalog> | Catalog,
  loadFallback?: (locale: Locale) => Promise<Catalog> | Catalog,
): Promise<Translator> {
  const [catalog, fallback] = await Promise.all([
    Promise.resolve(loadCatalog(locale)),
    loadFallback ? Promise.resolve(loadFallback(locale)) : Promise.resolve(undefined),
  ]);
  return createCoreTranslator({
    locale,
    catalog,
    ...(fallback ? { fallback } : {}),
  });
}

export function createTranslator(options: TranslatorOptions): Translator {
  return createCoreTranslator(options);
}
