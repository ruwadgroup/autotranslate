import { describe, expect, it } from 'vitest';
import { issueToLookup } from './issues';

describe('issueToLookup', () => {
  it('maps invalid_type with expected + received', () => {
    const lookup = issueToLookup({ code: 'invalid_type', expected: 'string', input: 42, path: [] });
    expect(lookup).toEqual({
      key: 'zod.invalid_type',
      params: { expected: 'string', received: 'number' },
    });
  });

  it('detects null and array as received types', () => {
    expect(
      issueToLookup({ code: 'invalid_type', expected: 'string', input: null, path: [] }),
    ).toMatchObject({ params: { received: 'null' } });
    expect(
      issueToLookup({ code: 'invalid_type', expected: 'string', input: [], path: [] }),
    ).toMatchObject({ params: { received: 'array' } });
  });

  it('keys too_small by origin', () => {
    expect(
      issueToLookup({
        code: 'too_small',
        origin: 'string',
        minimum: 3,
        inclusive: true,
        input: 'hi',
        path: [],
      }),
    ).toEqual({ key: 'zod.too_small.string', params: { minimum: 3, inclusive: true } });

    expect(
      issueToLookup({
        code: 'too_small',
        origin: 'array',
        minimum: 1,
        inclusive: true,
        input: [],
        path: [],
      }),
    ).toEqual({ key: 'zod.too_small.array', params: { minimum: 1, inclusive: true } });
  });

  it('routes exact-length too_small to the .exact subkey for sized origins', () => {
    expect(
      issueToLookup({
        code: 'too_small',
        origin: 'string',
        minimum: 5,
        inclusive: true,
        exact: true,
        input: 'hi',
        path: [],
      }),
    ).toEqual({ key: 'zod.too_small.string.exact', params: { minimum: 5, inclusive: true } });
  });

  it('does not append .exact for numeric origins', () => {
    const lookup = issueToLookup({
      code: 'too_small',
      origin: 'number',
      minimum: 0,
      inclusive: false,
      exact: true,
      input: 0,
      path: [],
    });
    expect(lookup).toEqual({
      key: 'zod.too_small.number',
      params: { minimum: 0, inclusive: false },
    });
  });

  it('maps too_big symmetrically', () => {
    expect(
      issueToLookup({
        code: 'too_big',
        origin: 'array',
        maximum: 10,
        inclusive: true,
        input: [],
        path: [],
      }),
    ).toEqual({ key: 'zod.too_big.array', params: { maximum: 10, inclusive: true } });
  });

  it('handles bigint minimum/maximum', () => {
    expect(
      issueToLookup({
        code: 'too_small',
        origin: 'bigint',
        minimum: 5n,
        inclusive: true,
        input: 1n,
        path: [],
      }),
    ).toMatchObject({ params: { minimum: 5 } });
  });

  it('keys invalid_format by format and forwards format-specific params', () => {
    expect(
      issueToLookup({ code: 'invalid_format', format: 'email', input: 'x', path: [] }),
    ).toEqual({ key: 'zod.invalid_format.email' });

    expect(
      issueToLookup({
        code: 'invalid_format',
        format: 'regex',
        pattern: '^a$',
        input: 'x',
        path: [],
      }),
    ).toEqual({ key: 'zod.invalid_format.regex', params: { pattern: '^a$' } });

    expect(
      issueToLookup({
        code: 'invalid_format',
        format: 'starts_with',
        prefix: 'foo',
        input: 'bar',
        path: [],
      }),
    ).toEqual({ key: 'zod.invalid_format.starts_with', params: { prefix: 'foo' } });

    expect(
      issueToLookup({
        code: 'invalid_format',
        format: 'includes',
        includes: 'baz',
        input: 'qux',
        path: [],
      }),
    ).toEqual({ key: 'zod.invalid_format.includes', params: { value: 'baz' } });
  });

  it('returns undefined for unknown formats', () => {
    expect(
      issueToLookup({ code: 'invalid_format', format: 'cosmic_ray', input: 'x', path: [] }),
    ).toBeUndefined();
  });

  it('keys unrecognized_keys with plural count', () => {
    const lookup = issueToLookup({
      code: 'unrecognized_keys',
      keys: ['a', 'b'],
      input: {},
      path: [],
    });
    expect(lookup).toEqual({
      key: 'zod.unrecognized_keys',
      params: { keys: 'a, b', count: 2 },
    });
  });

  it('keys invalid_value by single vs many', () => {
    expect(
      issueToLookup({ code: 'invalid_value', values: ['admin'], input: 'x', path: [] }),
    ).toEqual({ key: 'zod.invalid_value.single', params: { value: '"admin"' } });

    expect(
      issueToLookup({ code: 'invalid_value', values: ['a', 'b', 'c'], input: 'x', path: [] }),
    ).toEqual({ key: 'zod.invalid_value', params: { values: '"a", "b", "c"' } });
  });

  it('keys not_multiple_of with divisor', () => {
    expect(issueToLookup({ code: 'not_multiple_of', divisor: 5, input: 7, path: [] })).toEqual({
      key: 'zod.not_multiple_of',
      params: { divisor: 5 },
    });
  });

  it('returns undefined for codes we defer to zod locales', () => {
    expect(
      issueToLookup({ code: 'invalid_union', errors: [], input: null, path: [] }),
    ).toBeUndefined();
    expect(issueToLookup({ code: 'custom', input: null, path: [] })).toBeUndefined();
  });
});
