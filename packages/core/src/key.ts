import { shortHash } from './hash';

export const CONTEXT_KEY_SEPARATOR = '@@';

/** 12-hex catalog key for a plain-string source. `<T>` blocks use `canonicalKey`. */
export function sourceKey(source: string, context?: string): string {
  return shortHash(applyContextToKey(source, context));
}

export function applyContextToKey(key: string, context: string | undefined): string {
  return context ? `${key}${CONTEXT_KEY_SEPARATOR}${context}` : key;
}
