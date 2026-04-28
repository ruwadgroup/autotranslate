import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { hash } from '@autotranslate/core';
import { isMissing } from './catalog';
import type { CatalogEntry } from './types';

export interface CacheItem {
  readonly sourceHash: string;
  readonly translation: CatalogEntry;
}

export interface CacheChunk {
  readonly chunkHash: string;
  readonly items: Readonly<Record<string, CacheItem>>;
}

export interface CacheKeyContext {
  readonly source: string;
  readonly target: string;
  readonly providerSignature: string;
}

const CACHE_DIRNAME = '.cache';

function providerDir(outDir: string, providerSignature: string): string {
  return join(outDir, CACHE_DIRNAME, hash(providerSignature, 16));
}

function localePairDir(outDir: string, ctx: CacheKeyContext): string {
  return join(providerDir(outDir, ctx.providerSignature), `${ctx.source}-${ctx.target}`);
}

export function cacheChunkPath(outDir: string, ctx: CacheKeyContext, chunkPath: string): string {
  return join(localePairDir(outDir, ctx), `${chunkPath}.json`);
}

export function contentHash(source: CatalogEntry): string {
  return hash(typeof source === 'string' ? `s:${source}` : `t:${JSON.stringify(source)}`, 16);
}

export function computeChunkHash(chunkSource: Readonly<Record<string, CatalogEntry>>): string {
  const sorted = Object.keys(chunkSource).sort();
  const lines: string[] = [];
  for (const k of sorted) {
    const v = chunkSource[k];
    if (v === undefined) continue;
    lines.push(`${k}=${typeof v === 'string' ? `s:${v}` : `t:${JSON.stringify(v)}`}`);
  }
  return hash(lines.join('\n'), 16);
}

export async function readCacheChunk(path: string): Promise<CacheChunk> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as CacheChunk;
  } catch (error) {
    if (isMissing(error)) return { chunkHash: '', items: {} };
    throw error;
  }
}

export async function writeCacheChunk(path: string, data: CacheChunk): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * Detect and remove the legacy flat cache layout (`<outDir>/.cache/*.json`).
 * Pre-1.0 cache reset is acceptable; the next translate is a cold pass.
 * Returns the number of files removed (for logging).
 */
export async function pruneLegacyCache(outDir: string): Promise<number> {
  const dir = join(outDir, CACHE_DIRNAME);
  let removed = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        await rm(join(dir, entry.name), { force: true });
        removed += 1;
      }
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  return removed;
}
