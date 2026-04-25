import { describe, expect, it } from 'vitest';
import { extractVariables, formatICU, ICUParseError, parseICU } from './icu';

describe('parseICU', () => {
  it('parses a literal message', () => {
    const ast = parseICU('Hello, world!');
    expect(ast).toHaveLength(1);
  });

  it('throws ICUParseError on malformed input', () => {
    expect(() => parseICU('{name')).toThrow(ICUParseError);
  });

  it('the error preserves the original input for diagnostics', () => {
    try {
      parseICU('{count, plural');
    } catch (e) {
      expect(e).toBeInstanceOf(ICUParseError);
      expect((e as ICUParseError).input).toBe('{count, plural');
    }
  });
});

describe('formatICU', () => {
  it('substitutes simple variables', () => {
    expect(formatICU('Hello, {name}!', 'en', { name: 'Ada' })).toBe('Hello, Ada!');
  });

  it('shows placeholder when a variable is missing', () => {
    expect(formatICU('Hello, {name}!', 'en', {})).toBe('Hello, {name}!');
  });

  it('formats plural messages with #', () => {
    const msg = '{count, plural, one {# item} other {# items}}';
    expect(formatICU(msg, 'en', { count: 1 })).toBe('1 item');
    expect(formatICU(msg, 'en', { count: 5 })).toBe('5 items');
  });

  it('honors exact-match plural keys (=0)', () => {
    const msg = '{count, plural, =0 {empty} one {# item} other {# items}}';
    expect(formatICU(msg, 'en', { count: 0 })).toBe('empty');
    expect(formatICU(msg, 'en', { count: 1 })).toBe('1 item');
  });

  it('renders Russian plural categories correctly', () => {
    const msg = '{n, plural, one {# яблоко} few {# яблока} many {# яблок} other {# яблока}}';
    expect(formatICU(msg, 'ru', { n: 1 })).toBe('1 яблоко');
    expect(formatICU(msg, 'ru', { n: 2 })).toBe('2 яблока');
    expect(formatICU(msg, 'ru', { n: 5 })).toBe('5 яблок');
  });

  it('falls back to the other form when count is non-finite', () => {
    const msg = '{n, plural, one {# item} other {# items}}';
    expect(formatICU(msg, 'en', {})).toBe(' items');
  });

  it('handles select branches', () => {
    const msg = '{gender, select, male {he} female {she} other {they}}';
    expect(formatICU(msg, 'en', { gender: 'male' })).toBe('he');
    expect(formatICU(msg, 'en', { gender: 'female' })).toBe('she');
    expect(formatICU(msg, 'en', { gender: 'unknown' })).toBe('they');
  });

  it('formats numbers with Intl', () => {
    expect(formatICU('{n, number, percent}', 'en', { n: 0.42 })).toBe('42%');
  });

  it('formats dates with Intl', () => {
    const date = new Date('2024-06-15T12:00:00Z');
    expect(formatICU('{d, date, short}', 'en-US', { d: date })).toMatch(/6\/15\/24|6\/15\/2024/);
  });

  it('drops tag wrappers in string output', () => {
    expect(formatICU('Click <link>here</link>', 'en', {})).toBe('Click here');
  });
});

describe('extractVariables', () => {
  it('returns the set of variable names', () => {
    const vars = extractVariables(
      'Hello, {name}! You have {count, plural, one {# item} other {# items}}.',
    );
    expect(new Set(vars)).toEqual(new Set(['name', 'count']));
  });

  it('finds variables inside select branches', () => {
    const vars = extractVariables(
      '{gender, select, male {Mr. {name}} female {Ms. {name}} other {{name}}}',
    );
    expect(new Set(vars)).toEqual(new Set(['gender', 'name']));
  });
});
