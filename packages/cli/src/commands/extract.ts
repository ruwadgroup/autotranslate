import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import type { CatalogEntry, Manifest } from '@autotranslate/core';
import fg from 'fast-glob';
import { localeCatalogPath, writeCatalog, writeManifest } from '../catalog';
import { extractFile } from '../extract/extractor';
import type { ExtractResult, ResolvedConfig } from '../types';

/**
 * Scan all source files matched by `config.content`, build the canonical
 * source-locale catalog, and persist it to `<outDir>/<source>.json` along
 * with `<outDir>/.meta.json`.
 */
export async function extract(resolved: ResolvedConfig): Promise<ExtractResult> {
  const { cwd, config, outDir } = resolved;
  const files = await fg(config.content, {
    cwd,
    absolute: true,
    ignore: ['**/node_modules/**', `${config.outDir}/**`],
  });

  const messages: Record<string, CatalogEntry> = {};
  const manifest: Manifest = {};

  for (const absolute of files) {
    const source = await readFile(absolute, 'utf8');
    const display = relative(cwd, absolute);
    const result = extractFile(display, source);
    Object.assign(messages, result.messages);
    for (const [key, meta] of Object.entries(result.manifest)) {
      manifest[key] = mergeMeta(manifest[key], meta);
    }
  }

  await writeCatalog(resolve(outDir, `${config.source}.json`), messages);
  await writeManifest(outDir, manifest);

  return { source: messages, manifest, fileCount: files.length };
}

function mergeMeta(
  existing: Manifest[string] | undefined,
  incoming: Manifest[string] | undefined,
): Manifest[string] {
  if (!existing) return incoming ?? {};
  if (!incoming) return existing;
  const occurrences = [...(existing.occurrences ?? []), ...(incoming.occurrences ?? [])];
  return {
    ...existing,
    ...incoming,
    ...(occurrences.length > 0 ? { occurrences } : {}),
  };
}

export { localeCatalogPath };
