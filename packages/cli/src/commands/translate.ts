import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { CatalogEntry, Locale, Manifest, MessageMeta } from '@autotranslate/core';
import { buildChunkLayout } from '@autotranslate/core/internal';
import type { Provider, TranslationItem } from '@autotranslate/providers';
import {
  type CacheItem,
  cacheChunkPath,
  computeChunkHash,
  contentHash,
  pruneLegacyCache,
  readCacheChunk,
  writeCacheChunk,
} from '../cache';
import {
  type CatalogFile,
  isMissing,
  readChunkedCatalog,
  readManifest,
  writeChunkedCatalog,
} from '../catalog';
import { resolveProvider } from '../provider-resolver';
import type { LocaleStats, ResolvedConfig, TranslateResult, TranslateStats } from '../types';

export interface TranslateOptions {
  /** Programmatic provider override (takes precedence over config). */
  readonly provider?: Provider;
  /** Restrict to a subset of target locales. */
  readonly only?: ReadonlyArray<Locale>;
}

/** Translate the source catalog into every target locale. */
export async function translate(
  resolved: ResolvedConfig,
  options: TranslateOptions = {},
): Promise<TranslateResult> {
  const { config, outDir } = resolved;
  const provider = options.provider ?? (await resolveProvider(resolved));
  const sourceCatalog = await readChunkedCatalog(outDir, config.source);
  const manifest = await readManifest(outDir);

  // One-shot 0.1.0 layout cleanup: migrate source from flat to chunked,
  // delete the legacy flat cache. Cheap no-ops on subsequent runs.
  if (await fileExists(join(outDir, `${config.source}.json`))) {
    await writeChunkedCatalog(outDir, config.source, sourceCatalog, manifest);
  }
  await pruneLegacyCache(outDir);

  const targets = options.only
    ? config.targets.filter((t) => options.only?.includes(t))
    : config.targets;
  const stats: LocaleStats = {};

  for (const target of targets) {
    if (target === config.source) {
      stats[target] = { fetched: 0, cached: 0, overridden: 0 };
      continue;
    }
    stats[target] = await translateLocale({
      provider,
      target,
      source: config.source,
      sourceCatalog,
      outDir,
      overrides: config.overrides,
      instruction: config.instruction,
      manifest,
    });
  }

  return { stats };
}

interface TranslateLocaleArgs {
  readonly provider: Provider;
  readonly target: Locale;
  readonly source: Locale;
  readonly sourceCatalog: CatalogFile;
  readonly outDir: string;
  readonly overrides: ResolvedConfig['config']['overrides'];
  readonly instruction: string | undefined;
  readonly manifest: Manifest;
}

async function translateLocale(args: TranslateLocaleArgs): Promise<TranslateStats> {
  const { provider, target, source, sourceCatalog, outDir, overrides, instruction, manifest } =
    args;

  const filtered: Record<string, MessageMeta | undefined> = {};
  for (const k of Object.keys(sourceCatalog)) filtered[k] = manifest[k];
  const layout = buildChunkLayout(filtered);

  const targetOverrides = overrides?.[target] ?? {};
  const ctx = { source, target, providerSignature: provider.signature };

  let fetched = 0;
  let cached = 0;
  let overridden = 0;
  const fullCatalog: CatalogFile = {};

  for (const [chunkPath, keys] of layout) {
    const chunkSource: CatalogFile = {};
    for (const k of keys) {
      const v = sourceCatalog[k];
      if (v !== undefined) chunkSource[k] = v;
    }
    const chunkHash = computeChunkHash(chunkSource);
    const cachePath = cacheChunkPath(outDir, ctx, chunkPath);
    const cache = await readCacheChunk(cachePath);

    const result: CatalogFile = {};
    const newCacheItems: Record<string, CacheItem> = {};
    const itemsToFetch: TranslationItem[] = [];

    // Tier 1 — chunk hash unchanged: serve everything from cache + overrides.
    const chunkUnchanged = cache.chunkHash !== '' && cache.chunkHash === chunkHash;

    for (const k of keys) {
      const sourceEntry = chunkSource[k];
      if (sourceEntry === undefined) continue;
      const sourceHash = contentHash(sourceEntry);

      if (targetOverrides[k] !== undefined) {
        result[k] = targetOverrides[k] ?? sourceEntry;
        newCacheItems[k] = { sourceHash, translation: result[k] };
        overridden += 1;
        continue;
      }

      const hit = cache.items[k];
      if (hit && hit.sourceHash === sourceHash) {
        result[k] = hit.translation;
        newCacheItems[k] = hit;
        cached += 1;
        continue;
      }

      // Cache miss / per-key change. Skip in Tier 1 mode (consistency is
      // already implied by the chunkHash match — the only reason to be here
      // is a programmer-induced anomaly).
      if (chunkUnchanged && hit) {
        result[k] = hit.translation;
        newCacheItems[k] = hit;
        cached += 1;
        continue;
      }

      const meta = manifest[k];
      const item: TranslationItem = {
        key: k,
        source: sourceEntry,
        ...(meta?.context ? { context: meta.context } : {}),
        ...(meta?.description ? { description: meta.description } : {}),
        ...(typeof meta?.maxChars === 'number' ? { maxChars: meta.maxChars } : {}),
      };
      itemsToFetch.push(item);
    }

    if (itemsToFetch.length > 0) {
      const apiResult = await provider.translate({
        source,
        target,
        items: itemsToFetch,
        ...(instruction ? { instruction } : {}),
      });
      for (const item of itemsToFetch) {
        const translation = apiResult.translations[item.key];
        if (translation === undefined) continue;
        result[item.key] = translation;
        newCacheItems[item.key] = { sourceHash: contentHash(item.source), translation };
        fetched += 1;
      }
    }

    Object.assign(fullCatalog, result);
    await writeCacheChunk(cachePath, { chunkHash, items: newCacheItems });
  }

  await writeChunkedCatalog(outDir, target, fullCatalog, manifest);
  return { fetched, cached, overridden };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

export type { CatalogEntry };
