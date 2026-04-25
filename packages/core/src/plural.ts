import type { Locale } from './types';

/**
 * CLDR plural categories. `select()` from `Intl.PluralRules` returns one of
 * these for any non-finite or finite number.
 */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

const cardinalCache = new Map<Locale, Intl.PluralRules>();
const ordinalCache = new Map<Locale, Intl.PluralRules>();

function rules(locale: Locale, type: 'cardinal' | 'ordinal'): Intl.PluralRules {
  const cache = type === 'cardinal' ? cardinalCache : ordinalCache;
  let r = cache.get(locale);
  if (!r) {
    r = new Intl.PluralRules(locale, { type });
    cache.set(locale, r);
  }
  return r;
}

/**
 * Return the CLDR plural category for `n` in the given locale.
 *
 * `cardinal` (the default) is used for plural messages — "1 item" vs "2 items".
 * `ordinal` is used for ranking — "1st", "2nd", "3rd".
 */
export function getPluralCategory(
  locale: Locale,
  n: number,
  type: 'cardinal' | 'ordinal' = 'cardinal',
): PluralCategory {
  return rules(locale, type).select(n) as PluralCategory;
}

/**
 * Reset cached `Intl.PluralRules` instances. Exposed for tests; production
 * code never needs to call this.
 */
export function clearPluralRulesCache(): void {
  cardinalCache.clear();
  ordinalCache.clear();
}
