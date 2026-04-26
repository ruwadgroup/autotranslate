import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hash } from '@autotranslate/core';
import { isMissing } from './catalog';
import type { CatalogEntry } from './types';

/**
 * Per-(source, target, providerSig) cache. Each entry stores the
 * source-content hash that produced the translation; on the next run, we
 * skip translation when the hash still matches.
 */
export interface CacheEntry {
  readonly contentHash: string;
  readonly translation: CatalogEntry;
}

export type CacheFile = Record<string, CacheEntry>;

export interface CacheKeyContext {
  readonly source: string;
  readonly target: string;
  readonly providerSignature: string;
}

const CACHE_DIRNAME = '.cache';

export function cacheFilePath(outDir: string, ctx: CacheKeyContext): string {
  const sig = hash(`${ctx.source}|${ctx.target}|${ctx.providerSignature}`, 16);
  return join(outDir, CACHE_DIRNAME, `${sig}.json`);
}

export function contentHash(source: CatalogEntry): string {
  return hash(typeof source === 'string' ? `s:${source}` : `t:${JSON.stringify(source)}`, 16);
}

export async function readCache(path: string): Promise<CacheFile> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as CacheFile;
  } catch (error) {
    if (isMissing(error)) return {};
    throw error;
  }
}

export async function writeCache(path: string, cache: CacheFile): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}
