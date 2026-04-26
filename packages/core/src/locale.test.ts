import { describe, expect, it } from 'vitest';
import {
  determineLocale,
  getDirection,
  getLocaleEmoji,
  getLocaleName,
  getLocaleProperties,
  isSameLanguage,
  isValidLocale,
  matchLocale,
  parseAcceptLanguage,
  standardizeLocale,
} from './locale';

describe('isValidLocale', () => {
  it.each(['en', 'en-US', 'pt-BR', 'zh-Hans-CN', 'sr-Latn-RS'])('accepts %s', (tag) => {
    expect(isValidLocale(tag)).toBe(true);
  });

  it.each(['', '!', 'en_US?'])('rejects %s', (tag) => {
    expect(isValidLocale(tag)).toBe(false);
  });
});

describe('standardizeLocale', () => {
  it('canonicalizes case and aliases', () => {
    expect(standardizeLocale('EN-us')).toBe('en-US');
    expect(standardizeLocale('iw')).toBe('he');
    expect(standardizeLocale('iw-IL')).toBe('he-IL');
    expect(standardizeLocale('sh')).toMatch(/^sr-Latn/);
  });

  it('throws on invalid input', () => {
    expect(() => standardizeLocale('!!!')).toThrow();
  });
});

describe('getDirection', () => {
  it.each(['ar', 'fa', 'he', 'ur', 'ar-EG'])('marks %s as rtl', (tag) => {
    expect(getDirection(tag)).toBe('rtl');
  });

  it.each(['en', 'en-US', 'fr', 'ja', 'zh-Hans'])('marks %s as ltr', (tag) => {
    expect(getDirection(tag)).toBe('ltr');
  });
});

describe('parseAcceptLanguage', () => {
  it('orders by quality descending', () => {
    const parsed = parseAcceptLanguage('en;q=0.5, fr;q=1.0, de;q=0.8');
    expect(parsed.map((e) => e.tag)).toEqual(['fr', 'de', 'en']);
  });

  it('defaults missing q to 1', () => {
    const parsed = parseAcceptLanguage('en, fr;q=0.7');
    expect(parsed[0]?.tag).toBe('en');
    expect(parsed[0]?.q).toBe(1);
  });

  it('drops "*" and q=0 entries', () => {
    const parsed = parseAcceptLanguage('*, en;q=0, fr;q=0.5');
    expect(parsed.map((e) => e.tag)).toEqual(['fr']);
  });
});

describe('matchLocale', () => {
  const supported = ['en', 'es', 'fr-CA'];

  it('prefers path over cookie and accept', () => {
    expect(
      matchLocale({
        path: '/es/about',
        cookie: 'fr',
        accept: 'en',
        defaultLocale: 'en',
        supported,
      }),
    ).toBe('es');
  });

  it('falls back to cookie when path missing', () => {
    expect(
      matchLocale({
        cookie: 'fr-CA',
        accept: 'en',
        defaultLocale: 'en',
        supported,
      }),
    ).toBe('fr-CA');
  });

  it('parses accept-language when no other signal exists', () => {
    expect(
      matchLocale({
        accept: 'de;q=0.8, fr;q=1',
        defaultLocale: 'en',
        supported,
      }),
    ).toBe('fr-CA');
  });

  it('matches by language when region differs', () => {
    expect(
      matchLocale({
        accept: 'fr-FR',
        defaultLocale: 'en',
        supported,
      }),
    ).toBe('fr-CA');
  });

  it('returns the default when nothing matches', () => {
    expect(
      matchLocale({
        accept: 'ja',
        defaultLocale: 'en',
        supported,
      }),
    ).toBe('en');
  });
});

describe('getLocaleName', () => {
  it('returns a display name', () => {
    expect(getLocaleName('en', 'en')).toMatch(/english/i);
    expect(getLocaleName('fr', 'en')).toMatch(/french/i);
  });

  it('returns the autonym when no display locale is given', () => {
    // `Français` in French; some platforms title-case the first letter.
    expect(getLocaleName('fr').toLowerCase()).toContain('français');
  });
});

describe('getLocaleEmoji', () => {
  it.each([
    ['en-US', '🇺🇸'],
    ['fr-FR', '🇫🇷'],
    ['ja-JP', '🇯🇵'],
  ])('%s → %s', (tag, expected) => {
    expect(getLocaleEmoji(tag)).toBe(expected);
  });

  it('returns undefined when no region is present', () => {
    expect(getLocaleEmoji('en')).toBeUndefined();
  });
});

describe('isSameLanguage', () => {
  it.each([
    ['en', 'en-US', true],
    ['en-GB', 'en-US', true],
    ['en', 'fr', false],
    ['zh-Hans', 'zh-Hant', true],
  ])('isSameLanguage(%s, %s) === %s', (a, b, expected) => {
    expect(isSameLanguage(a, b)).toBe(expected);
  });
});

describe('getLocaleProperties', () => {
  it('resolves region + direction + autonym', () => {
    const props = getLocaleProperties('fr-FR');
    expect(props.tag).toBe('fr-FR');
    expect(props.languageCode).toBe('fr');
    expect(props.regionCode).toBe('FR');
    expect(props.direction).toBe('ltr');
    expect(props.emoji).toBe('🇫🇷');
    expect(props.nativeName.toLowerCase()).toContain('français');
  });

  it('marks rtl languages', () => {
    expect(getLocaleProperties('ar').direction).toBe('rtl');
  });
});

describe('determineLocale', () => {
  it('returns the first supported preference', () => {
    expect(determineLocale(['de', 'fr', 'en'], ['en', 'fr'], 'en')).toBe('fr');
  });

  it('falls back to language match', () => {
    expect(determineLocale(['fr-FR'], ['fr-CA', 'en'], 'en')).toBe('fr-CA');
  });

  it('returns the default when nothing matches', () => {
    expect(determineLocale(['ja'], ['en', 'fr'], 'en')).toBe('en');
  });
});
