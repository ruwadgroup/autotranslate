import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cacheChunkPath,
  computeChunkHash,
  contentHash,
  readCacheChunk,
  writeCacheChunk,
} from './cache';

describe('cacheChunkPath', () => {
  it('is stable per (provider-sig, source-target, chunk-path)', () => {
    const a = cacheChunkPath(
      '/out',
      { source: 'en', target: 'es', providerSignature: 'stub' },
      'components/Header',
    );
    const b = cacheChunkPath(
      '/out',
      { source: 'en', target: 'es', providerSignature: 'stub' },
      'components/Header',
    );
    expect(a).toBe(b);
  });

  it('differs by target locale', () => {
    const a = cacheChunkPath(
      '/out',
      { source: 'en', target: 'es', providerSignature: 'stub' },
      'x',
    );
    const b = cacheChunkPath(
      '/out',
      { source: 'en', target: 'fr', providerSignature: 'stub' },
      'x',
    );
    expect(a).not.toBe(b);
  });

  it('differs by chunk path', () => {
    const ctx = { source: 'en', target: 'es', providerSignature: 'stub' };
    expect(cacheChunkPath('/out', ctx, 'a')).not.toBe(cacheChunkPath('/out', ctx, 'b'));
  });
});

describe('contentHash', () => {
  it('differs between strings and structured trees', () => {
    expect(contentHash('Hi')).not.toBe(contentHash([{ type: 'text', value: 'Hi' }]));
  });

  it('is deterministic', () => {
    expect(contentHash('Hi')).toBe(contentHash('Hi'));
  });
});

describe('computeChunkHash', () => {
  it('is order-independent', () => {
    const a = computeChunkHash({ a: '1', b: '2' });
    const b = computeChunkHash({ b: '2', a: '1' });
    expect(a).toBe(b);
  });

  it('changes when content changes', () => {
    const a = computeChunkHash({ a: '1' });
    const b = computeChunkHash({ a: '2' });
    expect(a).not.toBe(b);
  });

  it('returns the same hash for empty inputs', () => {
    expect(computeChunkHash({})).toBe(computeChunkHash({}));
  });
});

describe('readCacheChunk / writeCacheChunk', () => {
  it('round-trips through the filesystem', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autotranslate-cache-'));
    const file = join(dir, 'sig', 'en-es', 'chunk.json');
    await writeCacheChunk(file, {
      chunkHash: 'h0',
      items: { hello: { sourceHash: 'abc', translation: 'Hola' } },
    });
    const round = await readCacheChunk(file);
    expect(round.chunkHash).toBe('h0');
    expect(round.items.hello).toEqual({ sourceHash: 'abc', translation: 'Hola' });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      chunkHash: 'h0',
      items: { hello: { sourceHash: 'abc', translation: 'Hola' } },
    });
  });

  it('returns an empty chunk on miss', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autotranslate-cache-'));
    expect(await readCacheChunk(join(dir, 'missing.json'))).toEqual({
      chunkHash: '',
      items: {},
    });
  });

  it('handles structured-tree translations', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autotranslate-cache-'));
    const file = join(dir, 'cache.json');
    const tree = [{ type: 'text' as const, value: 'Hola' }];
    await writeCacheChunk(file, {
      chunkHash: 'h0',
      items: { 't.abc': { sourceHash: 'h1', translation: tree } },
    });
    const round = await readCacheChunk(file);
    expect(round.items['t.abc']?.translation).toEqual(tree);
  });
});
