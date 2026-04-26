import { formatICU } from './icu';
import type { StructuredMessage } from './jsx-tree';
import { renderTreeToString } from './jsx-tree';
import type { Catalog, CatalogEntry, Locale } from './types';

/**
 * Separator joining a literal `useT` key to its `$context` hint when both are
 * present. Identical strings used in different contexts get distinct catalog
 * entries via this suffix (e.g. `Submit@@form button`).
 */
export const CONTEXT_KEY_SEPARATOR = '@@';

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

/**
 * Reserved option keys consumed by the translator itself (translator hints
 * for the AI provider) rather than passed through as ICU placeholders.
 */
const RESERVED_OPTIONS: ReadonlySet<string> = new Set(['$context', '$description', '$maxChars']);

function splitParams(params: Readonly<Record<string, unknown>> | undefined): {
  readonly args: Record<string, unknown>;
  readonly context: string | undefined;
} {
  if (!params) return { args: {}, context: undefined };
  const args: Record<string, unknown> = {};
  let context: string | undefined;
  for (const k of Object.keys(params)) {
    if (k === '$context') {
      const v = params[k];
      if (typeof v === 'string' && v !== '') context = v;
      continue;
    }
    if (RESERVED_OPTIONS.has(k)) continue;
    args[k] = params[k];
  }
  return { args, context };
}

/**
 * Compose a lookup key from a literal `useT` key and an optional `$context`
 * hint. Mirrors the suffix the CLI extractor writes into the catalog.
 */
export function applyContextToKey(key: string, context: string | undefined): string {
  return context ? `${key}${CONTEXT_KEY_SEPARATOR}${context}` : key;
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
      const { args, context } = splitParams(params);
      const lookupKey = applyContextToKey(key, context);
      // Try the context-suffixed key first, then the bare key as a fallback —
      // the catalog may not yet have a context-specific translation.
      const entry = lookup(lookupKey) ?? (context ? lookup(key) : undefined);
      if (entry === undefined) {
        return onMissing ? onMissing(lookupKey, locale) : key;
      }
      if (typeof entry === 'string') {
        return formatICU(entry, locale, args);
      }
      return renderTreeToString(entry, locale, args);
    },
  };
}
