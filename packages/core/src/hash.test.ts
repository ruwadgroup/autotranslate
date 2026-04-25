import { describe, expect, it } from 'vitest';
import { hash, shortHash } from './hash';

describe('hash', () => {
  it('matches the SHA-256 spec for empty input', () => {
    expect(hash('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('matches the SHA-256 spec for "abc"', () => {
    expect(hash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('is deterministic across calls', () => {
    const a = hash('translate me');
    const b = hash('translate me');
    expect(a).toBe(b);
  });

  it('handles unicode input', () => {
    expect(hash('你好')).toBe(hash('你好'));
    expect(hash('café')).not.toBe(hash('cafe'));
  });

  it('truncates to the requested length', () => {
    expect(hash('abc', 12)).toHaveLength(12);
    expect(hash('abc', 64)).toHaveLength(64);
    expect(hash('abc', 1)).toHaveLength(1);
  });

  it('rejects out-of-range lengths', () => {
    expect(() => hash('abc', 0)).toThrow(RangeError);
    expect(() => hash('abc', 65)).toThrow(RangeError);
    expect(() => hash('abc', 1.5)).toThrow(RangeError);
  });
});

describe('shortHash', () => {
  it('returns the first 12 hex characters of the SHA-256 digest', () => {
    expect(shortHash('abc')).toBe('ba7816bf8f01');
    expect(shortHash('abc')).toHaveLength(12);
  });
});
