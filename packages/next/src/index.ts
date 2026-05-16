import type { Locale, Translator } from '@autotranslate/core';
import { createTranslator, WIRE_FORMAT_VERSION } from '@autotranslate/core';
import { fsCatalogLoader } from './catalog-loader';
import type { GetTOptions } from './types';
import { LOCALE_HEADER } from './types';

// Wire format this build was compiled against. Cross-checked against the
// loaded core at first `getT` call so a transitive version skew throws
// instead of corrupting the runtime. Bump in lockstep with core.
const EXPECTED_CORE_WIRE_FORMAT = 2;

let handshakeChecked = false;
function assertVersionHandshake(): void {
  if (handshakeChecked) return;
  handshakeChecked = true;
  if (WIRE_FORMAT_VERSION !== EXPECTED_CORE_WIRE_FORMAT) {
    throw new Error(
      `[autotranslate] version mismatch: @autotranslate/next expects ` +
        `@autotranslate/core wire format ${EXPECTED_CORE_WIRE_FORMAT}, but the loaded core ` +
        `reports ${WIRE_FORMAT_VERSION}. Pin both packages to the same release.`,
    );
  }
}

export { clearCatalogCache, fsCatalogLoader } from './catalog-loader';
export type { CatalogLoader, GetTOptions, NextLocaleConfig, ProxyOptions } from './types';
export { LOCALE_HEADER } from './types';

/** Locale set by the proxy middleware. `undefined` when the proxy didn't run. */
export async function getRequestLocale(): Promise<Locale | undefined> {
  const { headers } = await import('next/headers');
  const h = await headers();
  return h.get(LOCALE_HEADER) ?? undefined;
}

/** Translator bound to `locale`. Default loader reads `<cwd>/<outDir>`. */
export async function getT(locale: Locale, options: GetTOptions = {}): Promise<Translator> {
  assertVersionHandshake();
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

/** Dictionary-mode helper. Server-side counterpart of `useTranslations(ns)`. */
export async function getTranslations(
  locale: Locale,
  namespace?: string,
  options: GetTOptions = {},
): Promise<(key: string, params?: Readonly<Record<string, unknown>>) => string> {
  const translator = await getT(locale, options);
  const prefix = namespace ? `${namespace}.` : '';
  return (key, params) => translator.t(`${prefix}${key}`, params);
}
