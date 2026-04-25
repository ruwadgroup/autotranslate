import { afterEach, describe, expect, it } from 'vitest';
import { clearPluralRulesCache, getPluralCategory } from './plural';

afterEach(() => {
  clearPluralRulesCache();
});

describe('getPluralCategory', () => {
  it('returns the right CLDR category in English', () => {
    expect(getPluralCategory('en', 0)).toBe('other');
    expect(getPluralCategory('en', 1)).toBe('one');
    expect(getPluralCategory('en', 2)).toBe('other');
    expect(getPluralCategory('en', 100)).toBe('other');
  });

  it('returns Russian-specific categories', () => {
    expect(getPluralCategory('ru', 1)).toBe('one');
    expect(getPluralCategory('ru', 2)).toBe('few');
    expect(getPluralCategory('ru', 5)).toBe('many');
    expect(getPluralCategory('ru', 21)).toBe('one');
  });

  it('returns Arabic categories including zero/two', () => {
    expect(getPluralCategory('ar', 0)).toBe('zero');
    expect(getPluralCategory('ar', 1)).toBe('one');
    expect(getPluralCategory('ar', 2)).toBe('two');
  });

  it('supports ordinal type for English', () => {
    expect(getPluralCategory('en', 1, 'ordinal')).toBe('one');
    expect(getPluralCategory('en', 2, 'ordinal')).toBe('two');
    expect(getPluralCategory('en', 3, 'ordinal')).toBe('few');
    expect(getPluralCategory('en', 4, 'ordinal')).toBe('other');
  });
});
