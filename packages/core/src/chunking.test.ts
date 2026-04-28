import { describe, expect, it } from 'vitest';
import { buildChunkLayout, chunkPathFor } from './chunking';

describe('chunkPathFor', () => {
  it('uses alphabetically-first occurrence', () => {
    expect(
      chunkPathFor({
        occurrences: [
          { file: 'src/Z.tsx', line: 1 },
          { file: 'src/A.tsx', line: 1 },
          { file: 'src/M.tsx', line: 1 },
        ],
      }),
    ).toBe('src/A');
  });

  it('strips file extensions', () => {
    expect(chunkPathFor({ occurrences: [{ file: 'src/Header.tsx', line: 1 }] })).toBe('src/Header');
    expect(chunkPathFor({ occurrences: [{ file: 'src/util.ts', line: 1 }] })).toBe('src/util');
    expect(chunkPathFor({ occurrences: [{ file: 'pages/Index.jsx', line: 1 }] })).toBe(
      'pages/Index',
    );
  });

  it('normalizes Windows backslashes', () => {
    expect(chunkPathFor({ occurrences: [{ file: 'src\\Header.tsx', line: 1 }] })).toBe(
      'src/Header',
    );
  });

  it('strips leading ./', () => {
    expect(chunkPathFor({ occurrences: [{ file: './src/Header.tsx', line: 1 }] })).toBe(
      'src/Header',
    );
  });

  it('buckets @autotranslate/* node_modules under _external', () => {
    expect(
      chunkPathFor({
        occurrences: [{ file: 'node_modules/@autotranslate/zod/dist/source.js', line: 1 }],
      }),
    ).toBe('_external/zod');
  });

  it('falls back when no occurrences', () => {
    expect(chunkPathFor(undefined)).toBe('_external/_unknown');
    expect(chunkPathFor({})).toBe('_external/_unknown');
    expect(chunkPathFor({ occurrences: [] })).toBe('_external/_unknown');
  });

  it('handles dotfiles without dropping name', () => {
    expect(chunkPathFor({ occurrences: [{ file: 'src/.hidden', line: 1 }] })).toBe('src/.hidden');
  });
});

describe('buildChunkLayout', () => {
  it('groups keys by source file', () => {
    const layout = buildChunkLayout({
      'Sign out': { occurrences: [{ file: 'src/Header.tsx', line: 1 }] },
      Hello: { occurrences: [{ file: 'src/Header.tsx', line: 2 }] },
      Goodbye: { occurrences: [{ file: 'src/Footer.tsx', line: 1 }] },
    });
    expect([...layout.keys()].sort()).toEqual(['src/Footer', 'src/Header']);
    expect([...(layout.get('src/Header') ?? [])]).toEqual(['Hello', 'Sign out']);
    expect([...(layout.get('src/Footer') ?? [])]).toEqual(['Goodbye']);
  });

  it('splits oversized chunks alphabetically', () => {
    const manifest: Record<string, { occurrences: Array<{ file: string; line: number }> }> = {};
    for (let i = 0; i < 700; i++) {
      manifest[`key-${String(i).padStart(4, '0')}`] = {
        occurrences: [{ file: 'src/Big.tsx', line: 1 }],
      };
    }
    const layout = buildChunkLayout(manifest, { maxStringsPerChunk: 300 });
    const paths = [...layout.keys()].sort();
    expect(paths).toEqual(['src/Big.0', 'src/Big.1', 'src/Big.2']);
    const total = paths.reduce((sum, p) => sum + (layout.get(p)?.length ?? 0), 0);
    expect(total).toBe(700);
  });

  it('keeps small chunks unsplit', () => {
    const manifest: Record<string, { occurrences: Array<{ file: string; line: number }> }> = {
      a: { occurrences: [{ file: 'src/Small.tsx', line: 1 }] },
      b: { occurrences: [{ file: 'src/Small.tsx', line: 2 }] },
    };
    const layout = buildChunkLayout(manifest, { maxStringsPerChunk: 300 });
    expect([...layout.keys()]).toEqual(['src/Small']);
  });

  it('routes keys with no occurrences to _external/_unknown', () => {
    const layout = buildChunkLayout({
      orphan: undefined,
    });
    expect([...layout.keys()]).toEqual(['_external/_unknown']);
  });
});
