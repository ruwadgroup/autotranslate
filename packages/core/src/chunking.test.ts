import { describe, expect, it } from 'vitest';
import { bucketFor, buildChunkLayout } from './chunking';
import { TREE_KEY_PREFIX } from './jsx-tree';

describe('bucketFor', () => {
  it('returns the first hex digit by default (chunkBits=4)', () => {
    expect(bucketFor('a3f4b8c2d1e5')).toBe('a');
    expect(bucketFor('0a1b2c3d4e5f')).toBe('0');
  });

  it('strips the `t.` tree prefix before bucketing', () => {
    expect(bucketFor(`${TREE_KEY_PREFIX}b3c4d5e6f7a8`)).toBe('b');
  });

  it('returns "all" for chunkBits=0 (single flat file)', () => {
    expect(bucketFor('a3f4b8c2d1e5', 0)).toBe('all');
  });

  it('uses two hex chars for chunkBits=8 (256 buckets)', () => {
    expect(bucketFor('a3f4b8c2d1e5', 8)).toBe('a3');
  });

  it('uses three hex chars for chunkBits=12 (4096 buckets)', () => {
    expect(bucketFor('a3f4b8c2d1e5', 12)).toBe('a3f');
  });

  it('clamps invalid bit counts', () => {
    expect(bucketFor('a3f4b8c2d1e5', -1)).toBe('all');
    expect(bucketFor('a3f4b8c2d1e5', 999)).toBe('a3f');
  });
});

describe('buildChunkLayout', () => {
  it('groups keys into buckets by hash prefix', () => {
    const layout = buildChunkLayout({
      a3f4b8c2d1e5: { occurrences: [] },
      a3b1c9d4e2f7: { occurrences: [] },
      b1c2d3e4f5a6: { occurrences: [] },
      '0a1b2c3d4e5f': { occurrences: [] },
    });
    expect([...layout.keys()].sort()).toEqual(['0', 'a', 'b']);
    expect([...(layout.get('a') ?? [])]).toEqual(['a3b1c9d4e2f7', 'a3f4b8c2d1e5']);
    expect([...(layout.get('b') ?? [])]).toEqual(['b1c2d3e4f5a6']);
    expect([...(layout.get('0') ?? [])]).toEqual(['0a1b2c3d4e5f']);
  });

  it('alphabetizes within each bucket for stable diffs', () => {
    const layout = buildChunkLayout({
      a3f4b8c2d1e5: { occurrences: [] },
      a300000000aa: { occurrences: [] },
      a3b1c9d4e2f7: { occurrences: [] },
    });
    expect([...(layout.get('a') ?? [])]).toEqual(['a300000000aa', 'a3b1c9d4e2f7', 'a3f4b8c2d1e5']);
  });

  it('places tree keys (`t.<hash>`) in the same bucket as their hash', () => {
    const layout = buildChunkLayout({
      [`${TREE_KEY_PREFIX}a3f4b8c2d1e5`]: { occurrences: [] },
      a3b1c9d4e2f7: { occurrences: [] },
    });
    expect([...layout.keys()]).toEqual(['a']);
    expect(layout.get('a')?.length).toBe(2);
  });

  it('respects chunkBits=0 — every key in a single bucket', () => {
    const layout = buildChunkLayout(
      {
        a3f4b8c2d1e5: { occurrences: [] },
        b1c2d3e4f5a6: { occurrences: [] },
        '0a1b2c3d4e5f': { occurrences: [] },
      },
      { chunkBits: 0 },
    );
    expect([...layout.keys()]).toEqual(['all']);
    expect(layout.get('all')?.length).toBe(3);
  });

  it('respects chunkBits=8 — 256 buckets by first byte', () => {
    const layout = buildChunkLayout(
      {
        a3f4b8c2d1e5: { occurrences: [] },
        a300000000aa: { occurrences: [] },
        b1c2d3e4f5a6: { occurrences: [] },
      },
      { chunkBits: 8 },
    );
    expect([...layout.keys()].sort()).toEqual(['a3', 'b1']);
    expect(layout.get('a3')?.length).toBe(2);
  });
});
