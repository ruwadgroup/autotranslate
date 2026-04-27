import type { Locale, Translator } from '@autotranslate/core';
import { createTranslator } from '@autotranslate/core';
import { fsCatalogLoader } from './catalog-loader';
import type { GetTOptions } from './types';
import { LOCALE_HEADER } from './types';

export const VERSION = '0.0.0';

export { clearCatalogCache, fsCatalogLoader } from './catalog-loader';
export type { CatalogLoader, GetTOptions, NextLocaleConfig, ProxyOptions } from './types';
export { LOCALE_HEADER } from './types';

/**
 * Read the active locale set by the proxy middleware. Returns `undefined`
 * when the proxy didn't run.
 */
export async function getRequestLocale(): Promise<Locale | undefined> {
  const { headers } = await import('next/headers');
  const h = await headers();
  return h.get(LOCALE_HEADER) ?? undefined;
}

/**
 * Build a translator bound to `locale`. The default loader reads
 * `<cwd>/<outDir>/<locale>.json`.
 */
export async function getT(locale: Locale, options: GetTOptions = {}): Promise<Translator> {
  const cwd = options.cwd ?? process.cwd();
  const outDir = options.outDir ?? '.translations';
  const load = options.load ?? fsCatalogLoader(cwd, outDir);

  const [catalog, fallback] = await Promise.all([
    Promise.resolve(load(locale)),
    options.fallback ? Promise.resolve(load(options.fallback)) : Promise.resolve(undefined),
  ]);

  return createTranslator({
    locale,
    catalog,
    ...(fallback ? { fallback } : {}),
  });
}

/**
 * Dictionary-mode helper. Mirrors the client `useTranslations(ns)` hook.
 *
 * ```ts
 * const t = await getTranslations(locale, 'dashboard');
 * t('title'); // → catalog['dashboard.title']
 * ```
 */
export async function getTranslations(
  locale: Locale,
  namespace?: string,
  options: GetTOptions = {},
): Promise<(key: string, params?: Readonly<Record<string, unknown>>) => string> {
  const translator = await getT(locale, options);
  const prefix = namespace ? `${namespace}.` : '';
  return (key, params) => translator.t(`${prefix}${key}`, params);
}
