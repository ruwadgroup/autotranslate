import { formatICU } from './icu';
import type { StructuredMessage } from './jsx-tree';
import { renderTreeToString } from './jsx-tree';
import type { Catalog, CatalogEntry, Locale } from './types';

export const CONTEXT_KEY_SEPARATOR = '@@';

export interface TranslatorOptions {
  readonly locale: Locale;
  readonly catalog: Catalog;
  readonly fallback?: Catalog;
  readonly onMissing?: (key: string, locale: Locale) => string;
}

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

export function applyContextToKey(key: string, context: string | undefined): string {
  return context ? `${key}${CONTEXT_KEY_SEPARATOR}${context}` : key;
}

export interface Translator {
  readonly locale: Locale;
  t(key: string, params?: Readonly<Record<string, unknown>>): string;
  tree(key: string): StructuredMessage | undefined;
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
