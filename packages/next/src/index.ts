/**
 * Next.js server helpers for autotranslate.
 *
 * Designed for the App Router. Use this entry from RSC and route handlers.
 * The companion subpaths are:
 *
 * - `@autotranslate/next/middleware` — `createNextMiddleware()` for `proxy.ts`
 *   (Next 16 renamed `middleware` → `proxy`).
 * - `@autotranslate/next/plugin` — `withAutotranslate()` Next config wrapper.
 */

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
 * Read the active locale from the current request.
 *
 * Returns the value the proxy set in the `x-autotranslate-locale` header. If
 * the proxy didn't run (or didn't match), returns `undefined` and the caller
 * should fall back to its own signal (e.g. the `[lang]` URL param).
 *
 * Must be called from a server component, route handler, or server action.
 */
export async function getRequestLocale(): Promise<Locale | undefined> {
  const { headers } = await import('next/headers');
  const h = await headers();
  return h.get(LOCALE_HEADER) ?? undefined;
}

/**
 * Build a translator bound to `locale`.
 *
 * The default loader reads `<cwd>/<outDir>/<locale>.json` (the layout the CLI
 * writes). Pass `load` to swap in a different storage strategy (KV, embedded
 * JSON, network fetch, …). Pass `fallback` to use a second locale when a key
 * is missing — typically your source locale.
 *
 * Must be called from a server context — Node-runtime route handlers or
 * server components. Edge-runtime callers should pass a custom `load` that
 * doesn't touch the filesystem.
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
