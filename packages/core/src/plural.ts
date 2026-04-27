import type { Locale } from './types';

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

export const PLURAL_CATEGORIES: ReadonlyArray<PluralCategory> = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
];

export function isPluralCategory(value: string): value is PluralCategory {
  return (
    value === 'zero' ||
    value === 'one' ||
    value === 'two' ||
    value === 'few' ||
    value === 'many' ||
    value === 'other'
  );
}

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

/** Returns the CLDR plural category for `n`. */
export function getPluralCategory(
  locale: Locale,
  n: number,
  type: 'cardinal' | 'ordinal' = 'cardinal',
): PluralCategory {
  return rules(locale, type).select(n) as PluralCategory;
}

export function clearPluralRulesCache(): void {
  cardinalCache.clear();
  ordinalCache.clear();
}
