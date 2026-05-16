import { shortHash } from './hash';
import { TREE_KEY_PREFIX } from './jsx-tree';
import type { Catalog, CatalogEntry } from './types';

export const CONTEXT_KEY_SEPARATOR = '@@';

/** 12-hex catalog key for a plain-string source. `<T>` blocks use `canonicalKey`. */
export function sourceKey(source: string, context?: string): string {
  return shortHash(applyContextToKey(source, context));
}

export function applyContextToKey(key: string, context: string | undefined): string {
  return context ? `${key}${CONTEXT_KEY_SEPARATOR}${context}` : key;
}

const HASHED_KEY = /^[0-9a-f]{12}$/;
const HASHED_TREE_KEY = /^t\.[0-9a-f]{12}$/;

/** Coerce a pre-beta.2 literal-string key into the hashed format. Hashed keys pass through. */
export function migrateKey(key: string): string {
  if (HASHED_KEY.test(key)) return key;
  if (HASHED_TREE_KEY.test(key)) return key;
  if (key.startsWith(TREE_KEY_PREFIX)) return key;
  return shortHash(key);
}

/** Read-side compatibility shim for pre-beta.2 on-disk artifacts and hand-rolled fixtures. */
export function migrateCatalog(input: Readonly<Record<string, CatalogEntry>>): Catalog {
  const out: Catalog = {};
  for (const k of Object.keys(input)) {
    const v = input[k];
    if (v !== undefined) out[migrateKey(k)] = v;
  }
  return out;
}
