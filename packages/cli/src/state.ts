import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { hash } from '@autotranslate/core';
import { isMissing } from './catalog';
import type { CatalogEntry } from './types';

/**
 * Per-locale translation state: which source content each key was last
 * translated from. The translations themselves live in the catalog - this
 * file holds only the hashes needed to diff, so nothing is stored twice.
 *
 * State is COMMITTED alongside the catalogs. It is the diff input, so keeping
 * it out of version control means every fresh clone and every CI run
 * retranslates the entire catalog from scratch.
 */
export interface LocaleState {
  readonly version: number;
  /** `catalogKey -> contentHash(sourceEntry)` at translation time. */
  readonly keys: Readonly<Record<string, string>>;
}

export const STATE_VERSION = 1;
export const STATE_DIRNAME = '.state';

const EMPTY: LocaleState = { version: STATE_VERSION, keys: {} };

export function stateChunkPath(outDir: string, locale: string, chunkPath: string): string {
  return join(outDir, STATE_DIRNAME, locale, `${chunkPath}.json`);
}

export function contentHash(source: CatalogEntry): string {
  return hash(typeof source === 'string' ? `s:${source}` : `t:${JSON.stringify(source)}`, 16);
}

export async function readStateChunk(path: string): Promise<LocaleState> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<LocaleState>;
    if (parsed.version !== STATE_VERSION || typeof parsed.keys !== 'object' || !parsed.keys) {
      return EMPTY;
    }
    return { version: STATE_VERSION, keys: parsed.keys };
  } catch (error) {
    if (isMissing(error)) return EMPTY;
    // A corrupt state file must not break the build - a cold pass is safe.
    return EMPTY;
  }
}

export async function writeStateChunk(
  path: string,
  keys: Readonly<Record<string, string>>,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(keys).sort()) sorted[k] = keys[k] as string;
  await writeFile(
    path,
    `${JSON.stringify({ version: STATE_VERSION, keys: sorted }, null, 2)}\n`,
    'utf8',
  );
}

/** Remove state chunks for a locale that the current layout no longer covers. */
export async function pruneStateChunks(
  outDir: string,
  locale: string,
  keep: ReadonlySet<string>,
): Promise<void> {
  const dir = join(outDir, STATE_DIRNAME, locale);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    if (keep.has(name.slice(0, -'.json'.length))) continue;
    await rm(join(dir, name), { force: true });
  }
}

interface LegacyCacheChunk {
  readonly items?: Readonly<Record<string, { sourceHash?: string }>>;
}

/**
 * Seed state from the pre-1.0 `.cache/<providerHash>/<src>-<tgt>/<chunk>.json`
 * layout so upgrading users don't pay a full retranslation. The legacy cache
 * duplicated the translations; only the hashes are carried over.
 */
export async function migrateLegacyCache(
  outDir: string,
  source: string,
  targets: ReadonlyArray<string>,
): Promise<number> {
  const cacheRoot = join(outDir, '.cache');
  let migrated = 0;
  for (const target of targets) {
    const seen = new Map<string, Record<string, string>>();
    for (const providerDir of await safeReaddir(cacheRoot)) {
      const pairDir = join(cacheRoot, providerDir, `${source}-${target}`);
      for (const file of await safeReaddir(pairDir)) {
        if (!file.endsWith('.json')) continue;
        let chunk: LegacyCacheChunk;
        try {
          chunk = JSON.parse(await readFile(join(pairDir, file), 'utf8')) as LegacyCacheChunk;
        } catch {
          continue;
        }
        const bucket = file.slice(0, -'.json'.length);
        const keys = seen.get(bucket) ?? {};
        for (const [key, item] of Object.entries(chunk.items ?? {})) {
          if (typeof item?.sourceHash === 'string') keys[key] = item.sourceHash;
        }
        seen.set(bucket, keys);
      }
    }
    for (const [bucket, keys] of seen) {
      if (Object.keys(keys).length === 0) continue;
      const path = stateChunkPath(outDir, target, bucket);
      const existing = await readStateChunk(path);
      await writeStateChunk(path, { ...keys, ...existing.keys });
      migrated += Object.keys(keys).length;
    }
  }
  if (migrated > 0) await rm(cacheRoot, { recursive: true, force: true });
  return migrated;
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
