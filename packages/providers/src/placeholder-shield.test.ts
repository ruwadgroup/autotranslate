import { describe, expect, it } from 'vitest';
import { restorePlaceholders, shieldPlaceholders, UnsupportedICUError } from './placeholder-shield';

describe('shieldPlaceholders', () => {
  it('passes plain text through unchanged', () => {
    const { text, slots } = shieldPlaceholders('Hello world');
    expect(text).toBe('Hello world');
    expect(slots).toEqual([]);
  });

  it('replaces argument placeholders with sentinels', () => {
    const { text, slots } = shieldPlaceholders('Hello, {name}!');
    expect(text).toBe('Hello, [[ATPH:0]]!');
    expect(slots).toEqual(['{name}']);
  });

  it('numbers sentinels independently per occurrence', () => {
    const { text, slots } = shieldPlaceholders('{first} owes {second} {amount}');
    expect(text).toBe('[[ATPH:0]] owes [[ATPH:1]] [[ATPH:2]]');
    expect(slots).toEqual(['{first}', '{second}', '{amount}']);
  });

  it('captures formatter syntax for number / date / time', () => {
    const { text, slots } = shieldPlaceholders(
      'Total: {amount, number, currency} on {when, date, short}',
    );
    expect(text).toBe('Total: [[ATPH:0]] on [[ATPH:1]]');
    expect(slots).toEqual(['{amount, number, currency}', '{when, date, short}']);
  });

  it('throws on plural / select / tag input', () => {
    expect(() => shieldPlaceholders('{count, plural, one {# item} other {# items}}')).toThrow(
      UnsupportedICUError,
    );
    expect(() => shieldPlaceholders('See <a>docs</a>')).toThrow(UnsupportedICUError);
  });
});

describe('restorePlaceholders', () => {
  it('round-trips with shieldPlaceholders', () => {
    const { text, slots } = shieldPlaceholders('Hello, {name}!');
    expect(restorePlaceholders(text, slots)).toBe('Hello, {name}!');
  });

  it('substitutes sentinels back even when interleaved with translated copy', () => {
    const slots = ['{name}', '{count}'];
    expect(restorePlaceholders('Hola, [[ATPH:0]]! Tienes [[ATPH:1]] mensajes.', slots)).toBe(
      'Hola, {name}! Tienes {count} mensajes.',
    );
  });

  it('leaves orphan sentinels untouched', () => {
    expect(restorePlaceholders('hello [[ATPH:9]]', ['{name}'])).toBe('hello [[ATPH:9]]');
  });
});
