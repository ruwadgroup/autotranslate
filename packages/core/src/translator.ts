import { formatICU } from './icu';
import type { StructuredMessage } from './jsx-tree';
import { renderTreeToString, TREE_KEY_PREFIX } from './jsx-tree';
import { sourceKey } from './key';
import { recordMiss } from './miss';
import type { Catalog, CatalogEntry, Locale } from './types';

// Bumped on any change that could break runtime compatibility between
// @autotranslate/* packages (catalog key encoding, structured-tree shape,
// public ICU semantics). Consumers cross-check this at init.
export const WIRE_FORMAT_VERSION = 2;

export interface TranslatorOptions {
  readonly locale: Locale;
  readonly catalog: Catalog;
  readonly fallback?: Catalog;
  readonly onMissing?: (key: string, locale: Locale) => string;
}

export interface Translator {
  readonly locale: Locale;
  t(key: string, params?: Readonly<Record<string, unknown>>): string;
  tree(key: string): StructuredMessage | undefined;
  raw(key: string): CatalogEntry | undefined;
}

/**
 * Build a hash-keyed catalog from literal-keyed entries. Convenience for tests and
 * programmatic overrides — production catalogs come from the CLI already hashed.
 *
 * ```ts
 * const catalog = buildCatalog({ 'Sign out': 'Cerrar sesión' });
 * createTranslator({ locale: 'es', catalog }).t('Sign out'); // "Cerrar sesión"
 * ```
 */
export function buildCatalog(entries: Readonly<Record<string, CatalogEntry>>): Catalog {
  const out: Catalog = {};
  for (const k of Object.keys(entries)) {
    const value = entries[k];
    if (value === undefined) continue;
    out[k.startsWith(TREE_KEY_PREFIX) ? k : sourceKey(k)] = value;
  }
  return out;
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

export function createTranslator(options: TranslatorOptions): Translator {
  const { locale, catalog, fallback, onMissing } = options;

  const lookup = (key: string): CatalogEntry | undefined => {
    const hit = catalog[key];
    if (hit !== undefined) return hit;
    return fallback?.[key];
  };

  const lookupBySource = (key: string): CatalogEntry | undefined => {
    return key.startsWith(TREE_KEY_PREFIX) ? lookup(key) : lookup(sourceKey(key));
  };

  return {
    locale,
    raw: lookupBySource,
    tree(key) {
      const entry = lookupBySource(key);
      return Array.isArray(entry) ? entry : undefined;
    },
    t(key, params) {
      const { args, context } = splitParams(params);
      // Tree keys arrive pre-hashed (`t.<hex12>`); plain strings get hashed here.
      const isTreeKey = key.startsWith(TREE_KEY_PREFIX);
      const lookupKey = isTreeKey ? key : sourceKey(key, context);
      const entry =
        lookup(lookupKey) ?? (!isTreeKey && context ? lookup(sourceKey(key)) : undefined);
      if (entry === undefined) {
        if (onMissing) return onMissing(lookupKey, locale);
        recordMiss(lookupKey, locale);
        // For plain strings the key IS the source, so format it — otherwise
        // ICU placeholders leak to the UI on miss. Tree keys are opaque.
        return isTreeKey ? key : formatICU(key, locale, args);
      }
      if (typeof entry === 'string') {
        return formatICU(entry, locale, args);
      }
      return renderTreeToString(entry, locale, args);
    },
  };
}
