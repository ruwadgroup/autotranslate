import { formatICU } from './icu';
import type { StructuredMessage } from './jsx-tree';
import { renderTreeToString } from './jsx-tree';
import type { Catalog, CatalogEntry, Locale } from './types';

export interface TranslatorOptions {
  readonly locale: Locale;
  readonly catalog: Catalog;
  /**
   * Optional fallback catalog (typically the source-locale catalog). Used when
   * a key is missing from `catalog`.
   */
  readonly fallback?: Catalog;
  /**
   * Called when a key is missing in both `catalog` and `fallback`. Receives
   * the requested key; the return value is used as the translation. If
   * unset, the key itself is returned.
   */
  readonly onMissing?: (key: string, locale: Locale) => string;
}

export interface Translator {
  readonly locale: Locale;
  /**
   * Translate `key` and format it as a string. Works for both plain ICU
   * entries (`useT('Sign out')`) and structured trees (auto-flattened to
   * text). Returns `key` itself on miss when no `onMissing` is configured.
   */
  t(key: string, params?: Readonly<Record<string, unknown>>): string;
  /**
   * Look up a key and return the structured tree, or `undefined` when the
   * key is missing or maps to a plain string.
   */
  tree(key: string): StructuredMessage | undefined;
  /**
   * Look up a key and return the raw catalog entry (string or tree), or
   * `undefined` when missing in both `catalog` and `fallback`.
   */
  raw(key: string): CatalogEntry | undefined;
}

export function createTranslator(options: TranslatorOptions): Translator {
  const { locale, catalog, fallback, onMissing } = options;

  const lookup = (key: string): CatalogEntry | undefined => {
    const hit = catalog[key];
    if (hit !== undefined) return hit;
    return fallback?.[key];
  };

  return {
    locale,
    raw: lookup,
    tree(key) {
      const entry = lookup(key);
      return Array.isArray(entry) ? entry : undefined;
    },
    t(key, params) {
      const entry = lookup(key);
      const args = params ?? {};
      if (entry === undefined) {
        return onMissing ? onMissing(key, locale) : key;
      }
      if (typeof entry === 'string') {
        return formatICU(entry, locale, args);
      }
      return renderTreeToString(entry, locale, args);
    },
  };
}
