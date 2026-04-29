import { shortHash } from './hash';
import { formatICU } from './icu';
import type { StructuredMessage } from './jsx-tree';
import { renderTreeToString, TREE_KEY_PREFIX } from './jsx-tree';
import type { Catalog, CatalogEntry, Locale } from './types';

export const CONTEXT_KEY_SEPARATOR = '@@';

/**
 * Storage key for a plain-string source. `useT('Sign out')` and friends look
 * up their translation under `sourceKey('Sign out')` — a 12-char SHA-256
 * prefix. `<T>` blocks use `canonicalKey` instead, which already returns a
 * `t.`-prefixed hash.
 */
export function sourceKey(source: string, context?: string): string {
  return shortHash(applyContextToKey(source, context));
}

const HASHED_KEY = /^[0-9a-f]{12}$/;
const HASHED_TREE_KEY = /^t\.[0-9a-f]{12}$/;

/**
 * Bring an old catalog/manifest key into the 1.0.0-beta.2 hashed format.
 * Already-hashed keys pass through; literal source strings (the pre-beta.2
 * shape, possibly with `@@context` suffix) get hashed into 12-hex.
 */
export function migrateKey(key: string): string {
  if (HASHED_KEY.test(key)) return key;
  if (HASHED_TREE_KEY.test(key)) return key;
  if (key.startsWith(TREE_KEY_PREFIX)) return key;
  return shortHash(key);
}

/**
 * Apply `migrateKey` to every entry of a catalog. Read-side compatibility
 * shim — production runtime catalogs already use hashed keys, but pre-beta.2
 * artifacts on disk and hand-rolled fixtures may not.
 */
export function migrateCatalog(input: Readonly<Record<string, CatalogEntry>>): Catalog {
  const out: Catalog = {};
  for (const k of Object.keys(input)) {
    const v = input[k];
    if (v !== undefined) out[migrateKey(k)] = v;
  }
  return out;
}

/**
 * Build a hash-keyed catalog from literal-keyed entries — convenience for
 * tests, programmatic overrides, and stub fixtures. Production catalogs
 * come from the CLI which already emits hashed keys.
 *
 * ```ts
 * const catalog = buildCatalog({ 'Sign out': 'Cerrar sesión' });
 * const t = createTranslator({ locale: 'es', catalog });
 * t.t('Sign out'); // → "Cerrar sesión"
 * ```
 *
 * Keys starting with `t.` (canonical tree keys) are passed through untouched.
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
      // Tree keys are already hashed (`t.<hex12>`) — pass through. Plain
      // string keys are hashed at lookup time so the catalog stays compact.
      const isTreeKey = key.startsWith(TREE_KEY_PREFIX);
      const lookupKey = isTreeKey ? key : sourceKey(key, context);
      const entry =
        lookup(lookupKey) ?? (!isTreeKey && context ? lookup(sourceKey(key)) : undefined);
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
