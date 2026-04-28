import { type Catalog, createTranslator, type Locale } from '@autotranslate/core';
import { withTranslator } from '@autotranslate/core/standalone';
import enFallback from './catalog/en.json' with { type: 'json' };

export interface NextRequestTranslatorOptions {
  /** Override the resolved locale. Defaults to `getRequestLocale()` from `@autotranslate/next`. */
  readonly locale?: Locale;
  /** Override the catalog loader. Defaults to `@autotranslate/next`'s `fsCatalogLoader`. */
  readonly loadCatalog?: (locale: Locale) => Promise<Catalog> | Catalog;
  /** Locale used when neither header nor `locale` option is set. */
  readonly defaultLocale?: Locale;
}

/**
 * Wrap a Next.js Server Action / route handler so the bundled zod error map
 * sees a translator scoped to the request locale.
 *
 * ```ts
 * import { withRequestTranslator } from '@autotranslate/zod/next';
 *
 * export async function signUp(formData: FormData) {
 *   return withRequestTranslator(async () => userSchema.parseAsync(...));
 * }
 * ```
 */
export async function withRequestTranslator<R>(
  fn: () => R | Promise<R>,
  options: NextRequestTranslatorOptions = {},
): Promise<R> {
  const locale = options.locale ?? (await resolveLocale(options.defaultLocale ?? 'en'));
  const catalog = await loadCatalog(locale, options.loadCatalog);
  const translator = createTranslator({ locale, catalog, fallback: enFallback as Catalog });
  return withTranslator(translator, async () => fn());
}

async function resolveLocale(fallback: Locale): Promise<Locale> {
  const next = await import('@autotranslate/next');
  const fromHeader = await next.getRequestLocale();
  return fromHeader ?? fallback;
}

async function loadCatalog(
  locale: Locale,
  loader: NextRequestTranslatorOptions['loadCatalog'],
): Promise<Catalog> {
  if (loader) return loader(locale);
  const next = await import('@autotranslate/next');
  const load = next.fsCatalogLoader(process.cwd(), '.translations');
  return load(locale);
}
