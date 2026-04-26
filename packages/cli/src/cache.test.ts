import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cacheFilePath, contentHash, readCache, writeCache } from './cache';

describe('cacheFilePath', () => {
  it('produces a stable path per (source, target, signature) tuple', () => {
    const a = cacheFilePath('/out', { source: 'en', target: 'es', providerSignature: 'stub' });
    const b = cacheFilePath('/out', { source: 'en', target: 'es', providerSignature: 'stub' });
    const c = cacheFilePath('/out', { source: 'en', target: 'fr', providerSignature: 'stub' });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    // Use posix-style includes to be cross-platform (Windows uses backslashes).
    expect(a.replace(/\\/g, '/')).toMatch(/\/out\/\.cache\/[a-f0-9]+\.json$/);
  });
});

describe('contentHash', () => {
  it('differs between strings and structured trees with the same shape', () => {
    expect(contentHash('Hi')).not.toBe(contentHash([{ type: 'text', value: 'Hi' }]));
  });

  it('is deterministic', () => {
    expect(contentHash('Hi')).toBe(contentHash('Hi'));
  });
});

describe('readCache / writeCache', () => {
  it('round-trips through the filesystem', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autotranslate-cache-'));
    const file = join(dir, '.cache', 'sig.json');
    await writeCache(file, {
      hello: { contentHash: 'abc', translation: 'Hola' },
    });
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      hello: { contentHash: 'abc', translation: 'Hola' },
    });
    expect(await readCache(file)).toEqual({
      hello: { contentHash: 'abc', translation: 'Hola' },
    });
  });

  it('returns an empty object when the file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autotranslate-cache-'));
    expect(await readCache(join(dir, 'missing.json'))).toEqual({});
  });

  it('handles structured-tree translations', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autotranslate-cache-'));
    const file = join(dir, 'cache.json');
    const tree = [{ type: 'text' as const, value: 'Hola' }];
    await writeCache(file, {
      'tree-key': { contentHash: 'h', translation: tree },
    });
    const round = await readCache(file);
    expect(round['tree-key']?.translation).toEqual(tree);
    // touching the file shouldn't have changed the hash mechanism
    await writeFile(file, JSON.stringify({}));
    expect(await readCache(file)).toEqual({});
  });
});
