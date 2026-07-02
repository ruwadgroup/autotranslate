import type { CatalogEntry, Locale, Manifest, MessageMeta } from '@autotranslate/core';
import { buildChunkLayout } from '@autotranslate/core/internal';
import type { Provider, TranslationContextItem, TranslationItem } from '@autotranslate/providers';
import {
  type CacheItem,
  cacheChunkPath,
  computeChunkHash,
  contentHash,
  readCacheChunk,
  writeCacheChunk,
} from '../cache';
import {
  type CatalogFile,
  readChunkedCatalog,
  readManifest,
  writeChunkedCatalog,
} from '../catalog';
import { writeCatalogModule } from '../catalog-module';
import { resolveProvider } from '../provider-resolver';
import type { LocaleStats, ResolvedConfig, TranslateResult, TranslateStats } from '../types';

export interface TranslateProgress {
  readonly target: Locale;
  readonly chunkPath: string;
  readonly status: 'started' | 'completed';
  readonly fetched?: number;
  readonly cached?: number;
  readonly overridden?: number;
}

export interface TranslateOptions {
  /** Programmatic provider override (takes precedence over config). */
  readonly provider?: Provider;
  /** Restrict to a subset of target locales. */
  readonly only?: ReadonlyArray<Locale>;
  /** Override `config.concurrency` for this run. */
  readonly concurrency?: number;
  /** Per-chunk progress events. Fires for `started` and `completed`. */
  readonly onProgress?: (event: TranslateProgress) => void;
}

/** Translate the source catalog into every target locale; chunks run in parallel. */
export async function translate(
  resolved: ResolvedConfig,
  options: TranslateOptions = {},
): Promise<TranslateResult> {
  const { config, outDir } = resolved;
  const provider = options.provider ?? (await resolveProvider(resolved));
  const sourceCatalog = await readChunkedCatalog(outDir, config.source);
  const manifest = await readManifest(outDir);

  const mergedInstruction = mergeInstruction(config.instruction, config.glossary);

  const requested = options.only
    ? config.targets.filter((t) => options.only?.includes(t))
    : config.targets;

  const stats: LocaleStats = {};
  for (const t of requested) stats[t] = { fetched: 0, cached: 0, overridden: 0 };

  const targets = requested.filter((t): t is Locale => t !== config.source);
  if (targets.length === 0) return { stats };

  const filtered: Record<string, MessageMeta | undefined> = {};
  for (const k of Object.keys(sourceCatalog)) filtered[k] = manifest[k];
  const layout = buildChunkLayout(filtered);

  const targetCatalogs = new Map<Locale, CatalogFile>();
  for (const t of targets) targetCatalogs.set(t, {});

  type Task = { target: Locale; chunkPath: string; keys: ReadonlyArray<string> };
  const tasks: Task[] = [];
  for (const target of targets) {
    for (const [chunkPath, keys] of layout) tasks.push({ target, chunkPath, keys });
  }

  const concurrency = Math.max(1, options.concurrency ?? config.concurrency);
  const onProgress = options.onProgress;

  await runWithConcurrency(tasks, concurrency, async (task) => {
    onProgress?.({ target: task.target, chunkPath: task.chunkPath, status: 'started' });
    const result = await translateChunk({
      provider,
      source: config.source,
      target: task.target,
      sourceCatalog,
      manifest,
      chunkPath: task.chunkPath,
      keys: task.keys,
      outDir,
      overrides: config.overrides,
      instruction: mergedInstruction,
    });
    Object.assign(targetCatalogs.get(task.target) ?? {}, result.catalog);
    const s = stats[task.target] ?? { fetched: 0, cached: 0, overridden: 0 };
    stats[task.target] = {
      fetched: s.fetched + result.fetched,
      cached: s.cached + result.cached,
      overridden: s.overridden + result.overridden,
    };
    onProgress?.({
      target: task.target,
      chunkPath: task.chunkPath,
      status: 'completed',
      fetched: result.fetched,
      cached: result.cached,
      overridden: result.overridden,
    });
  });

  await Promise.all(
    [...targetCatalogs].map(([target, catalog]) =>
      writeChunkedCatalog(outDir, target, catalog, manifest),
    ),
  );

  await writeCatalogModule(outDir, config.source, [config.source, ...config.targets]);

  return { stats };
}

interface TranslateChunkArgs {
  readonly provider: Provider;
  readonly source: Locale;
  readonly target: Locale;
  readonly sourceCatalog: CatalogFile;
  readonly manifest: Manifest;
  readonly chunkPath: string;
  readonly keys: ReadonlyArray<string>;
  readonly outDir: string;
  readonly overrides: ResolvedConfig['config']['overrides'];
  readonly instruction: string | undefined;
}

interface TranslateChunkResult extends TranslateStats {
  readonly catalog: CatalogFile;
}

async function translateChunk(args: TranslateChunkArgs): Promise<TranslateChunkResult> {
  const {
    provider,
    source,
    target,
    sourceCatalog,
    manifest,
    chunkPath,
    keys,
    outDir,
    overrides,
    instruction,
  } = args;

  const chunkSource: CatalogFile = {};
  for (const k of keys) {
    const v = sourceCatalog[k];
    if (v !== undefined) chunkSource[k] = v;
  }
  const chunkHash = computeChunkHash(chunkSource);
  const ctx = { source, target, providerSignature: provider.signature };
  const cachePath = cacheChunkPath(outDir, ctx, chunkPath);
  const cache = await readCacheChunk(cachePath);

  const targetOverrides = overrides?.[target] ?? {};
  const result: CatalogFile = {};
  const newCacheItems: Record<string, CacheItem> = {};
  const itemsToFetch: TranslationItem[] = [];
  const contextItems: TranslationContextItem[] = [];

  const chunkUnchanged = cache.chunkHash !== '' && cache.chunkHash === chunkHash;
  let fetched = 0;
  let cached = 0;
  let overridden = 0;

  for (const k of keys) {
    const sourceEntry = chunkSource[k];
    if (sourceEntry === undefined) continue;
    const sourceHash = contentHash(sourceEntry);

    // Overrides are user-keyed by source string for ergonomics; storage is
    // keyed by hash. Look up overrides via the literal source value.
    const literalSource = typeof sourceEntry === 'string' ? sourceEntry : undefined;
    const overrideValue = literalSource ? targetOverrides[literalSource] : undefined;
    if (overrideValue !== undefined) {
      result[k] = overrideValue;
      newCacheItems[k] = { sourceHash, translation: overrideValue };
      overridden += 1;
      continue;
    }

    const hit = cache.items[k];
    if (hit && hit.sourceHash === sourceHash) {
      result[k] = hit.translation;
      newCacheItems[k] = hit;
      cached += 1;
      contextItems.push({ source: sourceEntry, translation: hit.translation });
      continue;
    }

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
      ...(contextItems.length > 0 ? { context: contextItems } : {}),
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

  await writeCacheChunk(cachePath, { chunkHash, items: newCacheItems });
  return { catalog: result, fetched, cached, overridden };
}

async function runWithConcurrency<T>(
  items: ReadonlyArray<T>,
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function pump(): Promise<void> {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      await worker(items[i] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => pump()));
}

function mergeInstruction(
  instruction: string | undefined,
  glossary: ReadonlyArray<string> | undefined,
): string | undefined {
  if (!glossary || glossary.length === 0) return instruction;
  const preamble =
    'Glossary — preserve these terms exactly; never translate or transliterate:\n' +
    glossary.map((term) => `- ${term}`).join('\n');
  return instruction ? `${preamble}\n\n${instruction}` : preamble;
}

export type { CatalogEntry };
