import type { CatalogEntry, Manifest, MessageOccurrence } from '@autotranslate/core';
import { readChunkedCatalog, readManifest } from '../catalog';
import type { ResolvedConfig } from '../types';

const KEY_PATTERN = /^(t\.)?[0-9a-f]{12}$/;

export interface FindResult {
  readonly key: string;
  readonly source: CatalogEntry | undefined;
  readonly occurrences: ReadonlyArray<MessageOccurrence>;
  readonly description?: string;
  readonly context?: string;
}

/** Look up a catalog key by 12-hex hash. Returns the source string and call sites. */
export async function find(resolved: ResolvedConfig, query: string): Promise<FindResult | null> {
  const key = normaliseQuery(query);
  if (!key) return null;

  const { config, outDir } = resolved;
  const [source, manifest]: [Record<string, CatalogEntry>, Manifest] = await Promise.all([
    readChunkedCatalog(outDir, config.source),
    readManifest(outDir),
  ]);

  const sourceEntry = source[key];
  const meta = manifest[key];
  if (!sourceEntry && !meta) return null;

  return {
    key,
    source: sourceEntry,
    occurrences: meta?.occurrences ?? [],
    ...(meta?.description ? { description: meta.description } : {}),
    ...(meta?.context ? { context: meta.context } : {}),
  };
}

function normaliseQuery(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (KEY_PATTERN.test(trimmed)) return trimmed;
  return null;
}
