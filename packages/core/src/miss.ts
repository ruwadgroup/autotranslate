import type { Locale } from './types';

const counts = new Map<string, number>();
const warned = new Set<string>();

const IS_DEV: boolean = (() => {
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  } catch {
    return false;
  }
})();

/** Internal — called from `createTranslator` on the default miss path. */
export function recordMiss(key: string, locale: Locale): void {
  const id = `${locale} ${key}`;
  counts.set(id, (counts.get(id) ?? 0) + 1);
  if (IS_DEV && !warned.has(id)) {
    warned.add(id);
    // eslint-disable-next-line no-console
    console.warn(
      `[autotranslate] missing translation for "${key}" in locale "${locale}" — falling back to source`,
    );
  }
}
