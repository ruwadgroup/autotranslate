import { type Catalog, createTranslator, type Locale } from '@autotranslate/core';
import { matchLocale } from '@autotranslate/core/locale';
import { withTranslator } from '@autotranslate/core/standalone';
import enFallback from './catalog/en.json' with { type: 'json' };

/** Structural shape of a fetch `Request` — works against any web-fetch runtime. */
export interface FetchRequest {
  readonly url: string;
  readonly headers: { get(name: string): string | null };
}

export interface RemixRequestTranslatorOptions {
  readonly availableLocales: ReadonlyArray<Locale>;
  readonly defaultLocale: Locale;
  readonly loadCatalog: (locale: Locale) => Promise<Catalog> | Catalog;
}

/**
 * Wrap a Remix `loader` / `action` so the bundled zod error map sees a
 * translator scoped to the request locale.
 *
 * ```ts
 * export async function action({ request }: ActionFunctionArgs) {
 *   return withRequestTranslator(request, opts, async () => {
 *     return userSchema.parseAsync(await request.formData());
 *   });
 * }
 * ```
 */
export async function withRequestTranslator<R>(
  request: FetchRequest,
  options: RemixRequestTranslatorOptions,
  fn: () => R | Promise<R>,
): Promise<R> {
  const locale = resolveLocale(request, options);
  const catalog = await options.loadCatalog(locale);
  const translator = createTranslator({ locale, catalog, fallback: enFallback as Catalog });
  return withTranslator(translator, async () => fn());
}

function resolveLocale(request: FetchRequest, options: RemixRequestTranslatorOptions): Locale {
  const cookie = request.headers.get('cookie');
  const accept = request.headers.get('accept-language');
  return matchLocale({
    path: pathnameOf(request.url),
    ...(accept ? { accept } : {}),
    ...(cookie ? { cookie } : {}),
    defaultLocale: options.defaultLocale,
    supported: options.availableLocales,
  });
}

function pathnameOf(href: string): string {
  const afterScheme = href.replace(/^[a-z][a-z0-9+\-.]*:\/\//i, '');
  const slash = afterScheme.indexOf('/');
  if (slash === -1) return '/';
  const rest = afterScheme.slice(slash);
  const query = rest.indexOf('?');
  const hash = rest.indexOf('#');
  const cut = [query, hash].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  return cut === undefined ? rest : rest.slice(0, cut);
}
