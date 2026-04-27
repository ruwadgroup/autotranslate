import { resolve } from 'node:path';
import type { CatalogEntry, Locale, Manifest } from '@autotranslate/core';
import type { Provider, TranslationItem } from '@autotranslate/providers';
import { type CacheFile, cacheFilePath, contentHash, readCache, writeCache } from '../cache';
import {
  type CatalogFile,
  localeCatalogPath,
  readCatalog,
  readManifest,
  writeCatalog,
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
  const sourcePath = resolve(outDir, `${config.source}.json`);
  const sourceCatalog = await readCatalog(sourcePath);
  const manifest = await readManifest(outDir);
  const sourceKeys = Object.keys(sourceCatalog);

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
      sourceKeys,
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
  readonly sourceKeys: ReadonlyArray<string>;
  readonly outDir: string;
  readonly overrides: ResolvedConfig['config']['overrides'];
  readonly instruction: string | undefined;
  readonly manifest: Manifest;
}

async function translateLocale(args: TranslateLocaleArgs): Promise<TranslateStats> {
  const {
    provider,
    target,
    source,
    sourceCatalog,
    sourceKeys,
    outDir,
    overrides,
    instruction,
    manifest,
  } = args;

  const cachePath = cacheFilePath(outDir, {
    source,
    target,
    providerSignature: provider.signature,
  });
  const cache = await readCache(cachePath);
  const targetPath = localeCatalogPath(outDir, target);
  const existing = await readCatalog(targetPath);

  const targetOverrides = overrides?.[target] ?? {};
  const items: TranslationItem[] = [];
  const next: CatalogFile = {};
  const nextCache: CacheFile = {};
  let cached = 0;
  let overridden = 0;

  for (const key of sourceKeys) {
    const sourceEntry = sourceCatalog[key];
    if (sourceEntry === undefined) continue;
    const hash = contentHash(sourceEntry);

    const override = targetOverrides[key];
    if (override !== undefined) {
      next[key] = override;
      nextCache[key] = { contentHash: hash, translation: override };
      overridden++;
      continue;
    }

    const cacheHit = cache[key];
    if (cacheHit && cacheHit.contentHash === hash) {
      next[key] = cacheHit.translation;
      nextCache[key] = cacheHit;
      cached++;
      continue;
    }

    const meta = manifest[key];
    const item: { -readonly [K in keyof TranslationItem]: TranslationItem[K] } = {
      key,
      source: sourceEntry,
    };
    if (meta?.context) item.context = meta.context;
    if (meta?.description) item.description = meta.description;
    if (typeof meta?.maxChars === 'number') item.maxChars = meta.maxChars;
    items.push(item);
  }

  let fetched = 0;
  if (items.length > 0) {
    const result = await provider.translate({
      source,
      target,
      items,
      ...(instruction ? { instruction } : {}),
    });
    for (const item of items) {
      const translation = result.translations[item.key];
      if (translation === undefined) continue;
      next[item.key] = translation;
      nextCache[item.key] = { contentHash: contentHash(item.source), translation };
      fetched++;
    }
  }

  // Carry over orphaned keys; `check` flags them for cleanup.
  for (const [k, v] of Object.entries(existing)) {
    if (!(k in next)) next[k] = v as CatalogEntry;
  }

  await writeCatalog(targetPath, next);
  await writeCache(cachePath, nextCache);

  return { fetched, cached, overridden };
}
